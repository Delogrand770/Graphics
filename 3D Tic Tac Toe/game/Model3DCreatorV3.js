// Model3DCreator.js (c) by Dr. Wayne Brown, Jan. 2014

// This code conforms to JSLint programming conventions, which requires all functions
// and variables to be defined before they are used. The main functions are at the bottom.

"use strict"

// Global definitions used in this code:
var Float32Array, Uint16Array, parseInt, parseFloat, console;

//------------------------------------------------------------------------------
// Common utility functions
//------------------------------------------------------------------------------

function normalize(vector) {
  var length = Math.sqrt(vector[0] * vector[0] + vector[1] * vector[1] + vector[2] * vector[2]);
  if (length > 0) {
    vector[0] /= length;
    vector[1] /= length;
    vector[2] /= length;
  } else {
    vector = null;
  }
  return vector;
}

//------------------------------------------------------------------------------
function calculateFaceNormal(p0, p1, p2) {
  var i;
  // v: new normal, v0: a vector from p1 to p0, v1: a vector from p1 to p2
  var v = new Float32Array(3);
  var v0 = new Float32Array(3);
  var v1 = new Float32Array(3);
  for ( i = 0; i < 3; i++) {
    v0[i] = p0[i] - p1[i];
    v1[i] = p2[i] - p1[i];
  }

  // The cross product of v0 and v1
  v[0] = v0[1] * v1[2] - v0[2] * v1[1];
  v[1] = v0[2] * v1[0] - v0[0] * v1[2];
  v[2] = v0[0] * v1[1] - v0[1] * v1[0];

  // Normalize the result
  return normalize(v);
}

//------------------------------------------------------------------------------
// StringParser: An object that can parse a string of text and pull out values.
//------------------------------------------------------------------------------
var StringParser = function() {
  // Constructor
  // The string to parse.
  this.str = null;
  // The current position in the string to be processed.
  this.index = null;

  //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // Initialize StringParser object
  this.init = function(str) {
    this.str = str;
    this.index = 0;
  };

  //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  this.isDelimiter = function(c) {
    var delimiter = false;
    if (c == '\t' || c == ' ' || c == '(' || c == ')' || c == '"') {
      delimiter = true;
    }
    return delimiter;
  };

  //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  this.skipDelimiters = function() {
    var i = this.index;
    while (this.isDelimiter(this.str.charAt(i)) && i < this.str.length) {
      i++;
    }
    this.index = i;
  };

  //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  this.getWordLength = function(start) {
    var i = start;
    while (!this.isDelimiter(this.str.charAt(i)) && i < this.str.length) {
      i++;
    }
    return i - start;
  }

  //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  this.skipToNextWord = function() {
    this.skipDelimiters();
    var n = this.getWordLength(this.index);
    this.index += (n + 1);
  };

  //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  this.getWord = function() {
    this.skipDelimiters();
    var n = this.getWordLength(this.index);
    if (n == 0) {
      return null;
    }
    var word = this.str.substr(this.index, n);
    this.index += (n + 1);

    return word;
  };

  //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  this.getInt = function() {
    var word = this.getWord();
    if (word) {
      return parseInt(word, 10);
    } else {
      return null;
    }
  };

  //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  this.getFloat = function() {
    var word = this.getWord();
    if (word) {
      return parseFloat(word);
    } else {
      return null;
    }
  };

  //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // Parses next 'word' into a series of integers. Assumes the integers are separated by /.
  this.getIndexes = function() {
    var j;
    var word = this.getWord();
    if (word) {
      var indexesAsStrings = word.split("/");
      var indexes = [];
      for (j=0; j<indexesAsStrings.length; j++) {
        indexes.push( parseInt(indexesAsStrings[j], 10) );
      }
      return indexes;
    } else {
      return null;
    }
  };

  //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  this.getRestOfLine = function() {
    return this.str.substr(this.index);
  }

};

//------------------------------------------------------------------------------
// Store a list of all texture maps that have been defined and set to GPU texture
// units. Since a GPU has a limited number of texture objects, these need to be 
// tracked to ensure a texture map is only defined once. It also will not create 
// new texture maps if the GPU texture units have all been used.
//------------------------------------------------------------------------------

function TextureMapsList() {
  this.number = 0;
  this.maps = [];
  
  //----------------------------------------------------------------------------
  this.textureUnitsAreAvailable = function(gl) {
    return (this.number < gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) );
  }

  //----------------------------------------------------------------------------
  this.getNextAvailableTextureUnit = function(gl) {
    if ( this.textureUnitsAreAvailable(gl) ) {
      return (this.number);
    } else {
      return -1;
    }
  }

  //----------------------------------------------------------------------------
  // Return an existing texture if one already exists.
  this.findTexture = function(imageFileName) {
    var j;
    for (j=0; j<this.maps.length; j++) {
      if (this.maps[j].imageFileName == imageFileName) {
        return this.maps[j];
      } 
    }
    return null;
  }

  //----------------------------------------------------------------------------
  this.addNewTexture = function(texture) {
    var existingTexture = this.findTexture(texture.imageFileName);
    if (! existingTexture) {
      this.maps.push( texture );
      this.number++;
    }
  }
}

// A list of all active texture maps.
var AllTextureMaps = new TextureMapsList();

//------------------------------------------------------------------------------
// A single texture map.
// Since a GPU has a limited number of texture objects, these need to be tracked
// to ensure a texture map is only defined once.
//------------------------------------------------------------------------------

function TextureMap() {
  this.imageFileName = null;   // Services as a unique ID for the texture map.
  this.textureUnit = -1;       // 0, 1, 2, etc. - the integer texture unit number
  this.textureUnitEnum = -1;   // gl.TEXTURE0, gl.TEXTURE1, etc.
  this.myImage = null;         // JavaScript object for the texture map image.
  this.glTextureObject = null; // JavaScript object that was returned by gl.createTexture();
  
  //-------------------------------------------------------------------
  // Start the initialization of the texture map. This needs to happen once.
  this.create = function(gl, program, imageFileName) {

    // Make sure a texture map with this file name does not already exist.
    var existingTexture = AllTextureMaps.findTexture(imageFileName);
    if ( existingTexture ) {
      console.log("Using an existing texture:" + imageFileName);
      return existingTexture;
    }
    
    // Make sure there is a texture unit available and get which texture unit to use.
    this.textureUnit = AllTextureMaps.getNextAvailableTextureUnit(gl);
    if (this.textureUnit < 0) {
      return null;
    }
    
    this.textureUnitEnum = gl.TEXTURE0 + this.textureUnit;
    //console.log("Creating texture map " + this.textureUnit + " using texture unit " + this.textureUnitEnum + " and image " + imageFileName);

    // Create a texture object
    var myTexture = gl.createTexture();
    if (! myTexture) {
      console.log('Failed to create the texture object for ' + imageFileName);
      return null;
    }

    // Create the image object
    var myImage = new Image();
    if (! myImage) {
      console.log('Failed to create the image object for ' + imageFileName);
      return null;
    }
    
    // Register the event handler to be called on loading the image.
    myImage.onload = 
      function() {
        setupTexture(gl, gl.TEXTURE0, myTexture, myImage);
      };

    // Flag to detect when the texture map image has been loaded.
    myImage.isLoaded = false;
    
    // Tell the browser to load the image
    myImage.src = imageFileName;

    this.imageFileName   = imageFileName;
    this.myImage         = myImage;
    this.glTextureObject = myTexture;
    
    // Keep a list of all the textures that have been created so they can be reused.
    //AllTextureMaps.addNewTexture(this);
    
    return this;
  }; 
}

//-------------------------------------------------------------------
// This function is done once per texture map
function setupTexture(gl, whichTextureUnit, myTexture, myImage) {
   
  // Flip the image's y axis
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);

  // Enable texture unit.
  gl.activeTexture(whichTextureUnit);

  // Bind the texture object to the target.
  gl.bindTexture(gl.TEXTURE_2D, myTexture);

  // Set the texture parameters.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

  // Copy the image into the WebGL texture object.
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, myImage);
  
  myImage.isLoaded = true;
}

//------------------------------------------------------------------------------
// Material Object
//------------------------------------------------------------------------------

function ModelMaterial(materialName) {
  this.name = materialName;
  this.Ns = null;
  this.Ka = null;
  this.Kd = null;
  this.Ks = null;
  this.Ni = null;
  this.d = null;
  this.illum = null;
  this.map_Kd = null;
  this.textureMap = null;
}

//------------------------------------------------------------------------------
function CreateModelMaterials(gl, program, dataString) {
  var allMaterials, currentMaterial;
  
  //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  function parseRGB(sp) {
    var color;

    color = new Float32Array(4);

    color[0] = sp.getFloat();
    color[1] = sp.getFloat();
    color[2] = sp.getFloat();
    color[3] = sp.getFloat();

    // if there was no alpha value, make the color opaque.
    if (!color[3]) {
      color[3] = 1.0;
    }

    return color;
  }

  //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  function parseDefinition(gl, program, dataString) {
    var lineIndex, sp, command, lines, materialName, currentMaterial;

    // Break up into lines and store them as array
    lines = dataString.split('\n');

    materialName = "";
    currentMaterial = null;
    sp = new StringParser();

    for ( lineIndex = 0; lineIndex < lines.length; lineIndex++) {

      sp.init(lines[lineIndex]);

      command = sp.getWord();

      if (command) {

        switch(command) {
          case '#':
            // Skip comments
            break;

          case 'newmtl':           
            // Start a new material definition.
            materialName = sp.getWord();
            currentMaterial = new ModelMaterial(materialName);
            allMaterials.push(currentMaterial);
            break;

          case 'Ns':
            //
            currentMaterial.Ns = sp.getFloat();
            break;

          case 'Ka':
            // Read the ambient color
            currentMaterial.Ka = parseRGB(sp);
            break;

          case 'Kd':
            // Read the diffuse color
            currentMaterial.Kd = parseRGB(sp);
            break;

          case 'Ks':
            // Read the specular color
            currentMaterial.Ks = parseRGB(sp);
            break;

          case 'Ni':
            // Read the specular color
            currentMaterial.Ni = sp.getFloat();
            break;

          case 'd':
            // Read the specular color
            currentMaterial.illum = sp.getFloat();
            break;

          case 'illum':
            // Read the specular color
            currentMaterial.illum = sp.getInt();
            break;

          case 'map_Kd':
            // Read the name of the texture map image
            currentMaterial.map_Kd = sp.getRestOfLine();
            currentMaterial.textureMap = new TextureMap();
            if (! currentMaterial.textureMap.create(gl, program, currentMaterial.map_Kd) ) {
              currentMaterial.textureMap = null;
            }
        } // end switch
      }
    } // end for-loop for processing lines
  // end parseDefinition
  };
  
  //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // body of CreateModelMaterials
  allMaterials = [];
  currentMaterial = null;
  
  parseDefinition(gl, program, dataString);
  
  return allMaterials;
}

//------------------------------------------------------------------------------
// A single face of 3D model, which can be composed of multiple, coplanar triangles.
//------------------------------------------------------------------------------

function ModelFace() {
  this.material = null;
  this.firstTriangleIndex = 0;
  this.numberTriangles = 0;
  this.normalVector = new Float32Array(3);
}

//------------------------------------------------------------------------------
// A 3D model that is created from .OBJ data.
//------------------------------------------------------------------------------

// All models are stored in a single, interleaved VOB (Vertex Object Buffer).
// Every triangle is defined by 3 vertices, containing the data:
//    x,y,z     position in space
//    nx,ny,ny  normal vector (either a face normal or a vertex normal)
//    r,g,b,a   a color (may be absent if the object is texture mapped)
//    s,t       a texture coordinate (absent if not texture mapped)
//
// Therefore a vertex will be one of 3 formats:
//   COLORED_MODEL:              x,y,z, nx,xy,nz, r,g,b,a       (10 floats)
//   TEXTURED_MODEL:             x,y,z, nx,xy,nz, s,t           ( 8 floats)
//   COLORED_AND_TEXTURED_MODEL: x,y,z, nx,xy,nz, r,g,b,a, s,t  (12 floats)
var COLORED_MODEL = 0;
var TEXTURED_MODEL = 1;
var COLORED_AND_TEXTURED_MODEL = 2;

// One normal vector and color per face
var FLAT_SHADING_MODEL = 0;
// One normal vector and color per vertex
var SMOOTH_SHADING_MODEL = 1;

//------------------------------------------------------------------------------
function Model3D(name) {
  // The model name.
  this.modelName = name;

  // Model shading - either FLAT_SHADING_MODEL or SMOOTH_SHADING_MODEL
  this.shading = FLAT_SHADING_MODEL;
  this.coloring = COLORED_MODEL;

  // The number of each type of element that defines the model.
  this.numberVertices = 0;
  this.numberFaces = 0;
  this.numberTriangles = 0;
  this.numberTextureCoordinates = 0;

  // A counter used when creating the model to index into the triangleIndexes array
  this.nextTriangleIndex = 0;

  // If a blender OBJ file contains more than one model, the vertex 
  // indexes are numbered sequentially for the entire file. This value 
  // remembers the offset to its vertices.
  this.verticesOffset = 0;
  this.textureCoordinatesOffset = 0;
   
  // The arrays that contain the model definition.
  this.vertices = null;
  this.vertexNormals = null;   // Only for SMOOTH_SHADING_MODEL
  this.vertexColors = null;    // Only for SMOOTH_SHADING_MODEL
  this.triangleIndexes = null;
  this.faces = null;           // Mainly for FLAT_SHADING_MODEL
  this.textureCoordinates = null;
  this.textureCoordinateIndexes = null;
  
  // The WebGL array buffer used to store the model.
  this.VOB = null;
  
  // The WebGL buffer ID, used to set the correct buffer for rendering. 
  this.bufferID = null;

  // Debugging - display normal vectors
  this.displayNormals = false;
  this.normalSegments = null;
  this.normalSegmentsBuffer = null;

  //------------------------------------------------------------------------------
  this.draw = function(gl, program) {
    var j, k, n, face;

    var FLOAT_SIZE = this.vertices.BYTES_PER_ELEMENT;
    var stride;
    var normalOffset = 3 * FLOAT_SIZE;
    var colorOffset = 6 * FLOAT_SIZE;
    var textureOffset;
    
    switch( this.coloring) {
      case COLORED_MODEL:
        stride = 10*FLOAT_SIZE;
        break;
      case TEXTURED_MODEL:
        stride = 8*FLOAT_SIZE;
        textureOffset = 6 * FLOAT_SIZE;
        break;
      case COLORED_AND_TEXTURED_MODEL:
        stride = 12*FLOAT_SIZE;
        textureOffset = 10 * FLOAT_SIZE;
        break;
    }

    // Set the drawing mode -- which tells the shader the offsets into the model data
    gl.uniform1i(program.colorMode, this.coloring);
    
    // Make this model's VOB (vertex object buffer) be the active buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferID);
    
    // Bind the vertices in the VOB to the a_Position shader variable
    gl.vertexAttribPointer(program.a_Position, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(program.a_Position);
        
    // Bind the normal vectors in the VOB to the a_Normal shader variable
    gl.vertexAttribPointer(program.a_Normal, 3, gl.FLOAT, false, stride, normalOffset);
    gl.enableVertexAttribArray(program.a_Normal);
        
    if (this.coloring == COLORED_MODEL || this.coloring == COLORED_AND_TEXTURED_MODEL) {
      // Bind the colors in the VOB to the a_Color shader variable
      gl.vertexAttribPointer(program.a_Color, 4, gl.FLOAT, false, stride, colorOffset);
      gl.enableVertexAttribArray(program.a_Color); 
    } else {
      // Disable the color attribute
      gl.disableVertexAttribArray(program.a_Color);  
    }
    
    if (this.coloring == TEXTURED_MODEL || this.coloring == COLORED_AND_TEXTURED_MODEL) {
      // Assume that the same texture map is used for the entire model.
      var texture = this.faces[0].material.textureMap;
      
      // Don't draw the object if its texture map has not been loaded.
      if (texture && texture.myImage && ! texture.myImage.isLoaded) {
        return;
      }
      
      // Set the active texture unit -- but only if the texture has loaded.
      gl.activeTexture(texture.textureUnitEnum);
      gl.bindTexture(gl.TEXTURE_2D, texture.glTextureObject);
        
      // Set the correct texture unit to the sampler
      gl.uniform1i(program.u_Sampler, texture.textureUnit);
    
      gl.vertexAttribPointer(program.a_TexCoord, 2, gl.FLOAT, false, stride, textureOffset);
      gl.enableVertexAttribArray(program.a_TexCoord);  
    } else {
      // Disable the texture coordinates
      gl.disableVertexAttribArray(program.a_TexCoord);  
    }
        
    // Draw the model
    gl.drawArrays(gl.TRIANGLES, 0, this.numberTriangles*3);

    // DEBUGGING - will draw the normal vector for each vertex or face
    if (this.displayNormals) {
      if (this.shading == FLAT_SHADING_MODEL) {
        this.drawFaceNormals(gl, program, this);
      } else {
        this.drawVertexNormals(gl, program, this.vertices, this.vertexNormals);
      }
    }
  };

  //------------------------------------------------------------------------------
  this.drawVertexNormals = function(gl, program, vertices, normals) {
    var v, k, n;
    var normalLength = 1.0;
    
    if (this.normalSegments == null) {
      // Calculate the normal vector lines.
      this.normalSegments = new Float32Array(this.numberVertices * 3 * 2);
      // Create the normal segments; the start is a vertex, the end is out the normal.
      n = 0;
      for ( v = 0; v < this.numberVertices; v++) {
        k = v * 3;
        // Starting point
        this.normalSegments[n++] = this.vertices[k];
        this.normalSegments[n++] = this.vertices[k + 1];
        this.normalSegments[n++] = this.vertices[k + 2];
        // ending point
        this.normalSegments[n++] = this.vertices[k] + this.vertexNormals[k] * normalLength;
        this.normalSegments[n++] = this.vertices[k + 1] + this.vertexNormals[k + 1] * normalLength;
        this.normalSegments[n++] = this.vertices[k + 2] + this.vertexNormals[k + 2] * normalLength;
      }

      // Create a buffer object to draw the normal vectors
      this.normalSegmentsBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.normalSegmentsBuffer);
      gl.vertexAttribPointer(program.a_Position, 3, gl.FLOAT, false, 0, 0);
      gl.bufferData(gl.ARRAY_BUFFER, this.normalSegments, gl.STATIC_DRAW);
    }

    gl.disableVertexAttribArray(program.a_Position);
    gl.disableVertexAttribArray(program.a_Normal);
    gl.disableVertexAttribArray(program.a_Color);

    // Draw the normal vector lines.
    gl.bindBuffer(gl.ARRAY_BUFFER, this.normalSegmentsBuffer);
    gl.vertexAttribPointer(program.a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(program.a_Position);

    gl.vertexAttrib4f(program.a_Color, 0.0, 0.0, 0.0, 1.0);

    gl.drawArrays(gl.LINES, 0, this.numberVertices * 2);
  };

  //------------------------------------------------------------------------------
  this.drawFaceNormals = function(gl, program) {
    var v, k, n, j0, j1, j2, start, faceIndex, theFace;
    var normalLength = 1.0;

    if (this.normalSegments == null) {
      // Calculate the normal vector lines.
      this.normalSegments = new Float32Array(this.numberFaces * 3 * 2);
      // Create the normal segments; the start is a vertex, the end is out the normal.
      start = [];
      n = 0;
      for ( faceIndex = 0; faceIndex < this.faces.length; faceIndex++) {
        theFace = this.faces[faceIndex];
        
        k = theFace.firstTriangleIndex;
        // Starting point - average of the face's vertices
        j0 = this.triangleIndexes[k] * 3;
        j1 = this.triangleIndexes[k + 1] * 3;
        j2 = this.triangleIndexes[k + 2] *3;

        start[0] = (this.vertices[j0] + this.vertices[j1] + this.vertices[j2]) / 3;
        start[1] = (this.vertices[j0 + 1] + this.vertices[j1 + 1] + this.vertices[j2 + 1]) / 3;
        start[2] = (this.vertices[j0 + 2] + this.vertices[j1 + 2] + this.vertices[j2 + 2]) / 3;
        this.normalSegments[n++] = start[0];
        this.normalSegments[n++] = start[1];
        this.normalSegments[n++] = start[2];
        // ending point
        this.normalSegments[n++] = start[0] + theFace.normalVector[0] * normalLength;
        this.normalSegments[n++] = start[1] + theFace.normalVector[1] * normalLength;
        this.normalSegments[n++] = start[2] + theFace.normalVector[2] * normalLength;
      }

      // Create a buffer object to draw the normal vectors
      this.normalSegmentsBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.normalSegmentsBuffer);
      gl.vertexAttribPointer(program.a_Position, 3, gl.FLOAT, false, 0, 0);
      gl.bufferData(gl.ARRAY_BUFFER, this.normalSegments, gl.STATIC_DRAW);
    }

    // Draw the normal vector lines.
    gl.bindBuffer(gl.ARRAY_BUFFER, this.normalSegmentsBuffer);
    gl.vertexAttribPointer(program.a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(program.a_Position);

    gl.disableVertexAttribArray(program.a_Color);
    gl.vertexAttrib4f(program.a_Color, 0.0, 0.0, 0.0, 1.0);

    gl.drawArrays(gl.LINES, 0, this.numberFaces * 2);
  };

  //------------------------------------------------------------------------------
  // Return the center value of the model on a particular model. 
  // The center point is the middle point on the axis between the maximum 
  // and minimum vertices on that axis. 
  this.getCenterValue = function(axis) {
    var j;
    // Find the limits along the axis.
    var max = -1e10;
    var min = +1e10;
    for (j=axis; j<this.numberVertices*3; j+=3) {
      if (this.vertices[j] > max) {
        max = this.vertices[j];
      }
      if (this.vertices[j] < min) {
        min = this.vertices[j];
      }
    }
    // Return the middle point between max and min.
    return ((max+min)/2);
  };
  
  //------------------------------------------------------------------------------
  // Return the center value of the model on a particular model. 
  // The center point is the middle point on the axis between the maximum 
  // and minimum vertices on that axis. 
  this.getCenterPoint = function() {
    var midX = this.getCenterValue(0);
    var midY = this.getCenterValue(1);
    var midZ = this.getCenterValue(2);
    return new Vector4([ midX, midY, midZ, 1]);
  };
}

//------------------------------------------------------------------------------
// Create one or more 3D models from .OBJ data. Returns an array of Model3D objects.
//------------------------------------------------------------------------------

function createModels3D(gl, program, fileName, scale, reverseNormals) {

  var modelIndex, allModels = [], allMaterials = [];
  var totalNumberVertices = 0;
  var totalNumberTextureCoordinates = 0;
  var dataString = '';

  //------------------------------------------------------------------------------
  // Helper functions
  //------------------------------------------------------------------------------
  function countFaceIndexes(sp) {

    var numberFaceIndexes = 0, word;

    word = sp.getWord();
    while (word) {
      numberFaceIndexes++;
      word = sp.getWord();
    }
    return numberFaceIndexes;
  }

  //------------------------------------------------------------------------------
  // Count the number of elements in each model defined in the data string.
  function countElements(gl, program, dataString) {
    var currentModel, sp, lines, k, command, shading, modelName, 
        materialFileName, htmlObject, materialData;

    currentModel = null;
    totalNumberVertices = 0;
    totalNumberTextureCoordinates = 0;

    // Create StringParser to parse each line of data
    sp = new StringParser();

    // Break up the input lines into an array, one line per array element.
    lines = dataString.split('\n');

    for ( k = 0; k < lines.length; k++) {

      // Put the line into the string parser.
      sp.init(lines[k]);

      // Get command
      command = sp.getWord();

      // Process the command
      if (command) {

        switch(command) {
          case '#':
            // Skip comments
            break;

          case 'mtllib':
            // Get the name of the data file that contains the material definitions
            materialFileName = sp.getWord();
            // Convert the file name by replacing the . with a _
            materialFileName = materialFileName.replace(".","_"); 
            // Find the HTML object that contains this material's data
            htmlObject = document.getElementById(materialFileName).contentDocument;
            materialData = htmlObject.body.innerText;
            
            if (! materialData && htmlObject.body.textContent) {
              // Try the Firefox way
              materialData = htmlObject.body.textContent;
            }
            
            // Create materials from the data
            if (materialData) {
              allMaterials = CreateModelMaterials(gl, program, materialData);
            }
            break;

          case 's':
            // Read type of shading: 0/off means FLAT, 1/on means SMOOTH
            shading = sp.getWord();
            if (shading == '0' || shading == 'off') {
              currentModel.shading = FLAT_SHADING_MODEL;
            } else if (shading == '1' || shading == 'on') {
              currentModel.shading = SMOOTH_SHADING_MODEL;
            }
            break;

          case 'o':
          case 'g':
            // Read Object name and create a new Model3D
            modelName = sp.getWord();
            currentModel = new Model3D(modelName);
            currentModel.verticesOffset = totalNumberVertices;
            currentModel.textureCoordinatesOffset = totalNumberTextureCoordinates;
            allModels.push(currentModel);
            break;

          case 'v':
            // Read vertex
            currentModel.numberVertices++;
            totalNumberVertices++;
            break;

          case 'vt':
            // Read vertex
            currentModel.numberTextureCoordinates++;
            totalNumberTextureCoordinates++;
            break;

          case 'usemtl':
            // Read Material name
            currentModel.numberMaterials++;
            break;

          case 'f':
            // Read face
            currentModel.numberFaces++;
            currentModel.numberTriangles += (countFaceIndexes(sp) - 2);
            break;
        }
      }

    }
  }

  //------------------------------------------------------------------------------
  // Find a Model3D by model name
  function findModel(modelName) {
    var j;
    for (j = 0; j < allModels.length; j++) {
      if (allModels[j].modelName == modelName) {
        return (allModels[j]);
      }
    }
    return null;
  }

  //------------------------------------------------------------------------------
  // Find a material by its name
  function findMaterial(materialName) {
    var j;
    for (j = 0; j < allMaterials.length; j++) {
      if (allMaterials[j].name == materialName) {
        return (allMaterials[j]);
      }
    }
    return null;
  }

  //------------------------------------------------------------------------------
  function parseFace(sp, material, model, reverseNormals) {
    var i, j, k, n, indexes, textureIndexes;
    var v0, v1, v2, v3;
    var normal, numberTriangles, last, newFace;
    var temp, q;
    
    newFace = new ModelFace();

    // get indices
    indexes = [];
    textureIndexes = [];
    
    i = sp.getIndexes();
    while (i) {
      // offset by 1 for zero subscripting of vertices.
      // offset by verticesOffset to get the index for this model
      indexes.push(i[0] - 1 - model.verticesOffset);
      
      if (model.numberTextureCoordinates > 0) {
        textureIndexes.push(i[i.length-1] - 1 - model.textureCoordinatesOffset);
      }
      
      // get the next vertex index for this face
      i = sp.getIndexes();
    }

    // get the first 3 indexes to calculate the face normal vector
    i = indexes[0] * 3;
    j = indexes[1] * 3;
    k = indexes[2] * 3;

    // calculate the normal vector
    v0 = [model.vertices[i], model.vertices[i + 1], model.vertices[i + 2]];
    v1 = [model.vertices[j], model.vertices[j + 1], model.vertices[j + 2]];
    v2 = [model.vertices[k], model.vertices[k + 1], model.vertices[k + 2]];
    normal = calculateFaceNormal(v0, v1, v2);

    // If the first 3 vertices were colinear, the normal is invalid
    if (normal == null) {
      if (indexes.length >= 4) {
        n = indexes[3] * 3;
        v3 = [model.vertices[n], model.vertices[n + 1], model.vertices[n + 2]];
        normal = calculateFaceNormal(v1, v2, v3);
      }
      if (normal == null) {
        // Create a fake normal vector
        normal = [0.0, 1.0, 0.0];
      }
    }

    if (reverseNormals) {
      normal[0] = -normal[0];
      normal[1] = -normal[1];
      normal[2] = -normal[2];
    }

    newFace.firstTriangleIndex = model.nextTriangleIndex;
    j = model.nextTriangleIndex;
    numberTriangles = 1;

    // Add the face to the face indexes.
    model.triangleIndexes[j++] = indexes[0];
    model.triangleIndexes[j++] = indexes[1];
    model.triangleIndexes[j++] = indexes[2];

    // If the face contains over 3 points, divide the face into triangles.
    n = 2;
    while (n+1 < indexes.length) {
      model.triangleIndexes[j++] = indexes[0];
      model.triangleIndexes[j++] = indexes[n];
      model.triangleIndexes[j++] = indexes[n+1];
      n++;
      numberTriangles++;
    }

    if (textureIndexes.length > 0) {
      // Update the texture coordinates for the face(s).
      j = model.nextTriangleIndex;
      model.textureCoordinateIndexes[j++] = textureIndexes[0];
      model.textureCoordinateIndexes[j++] = textureIndexes[1];
      model.textureCoordinateIndexes[j++] = textureIndexes[2];

      // If the face contains over 3 points, divide the face into triangles.
      n = 2;
      while (n+1 < indexes.length) {
        model.textureCoordinateIndexes[j++] = textureIndexes[0];
        model.textureCoordinateIndexes[j++] = textureIndexes[n];
        model.textureCoordinateIndexes[j++] = textureIndexes[n+1];
        n++;
      }
    }
    
    // Remember where to start storing the next face's triangles.
    model.nextTriangleIndex = j;
    
    // Set the new face's data fields.
    newFace.material = material;
    newFace.numberTriangles = numberTriangles;
    newFace.normalVector = normal;

    return newFace;
  }

  //------------------------------------------------------------------------------
  function fillModelArrays(dataString, scale, reverseNormals) {
    var lineIndex, command, modelName;
    var materialDefinition, newMaterial, materialName, materialData;
    var newFace;

    var currentModel = null;
    var currentMaterial = null;

    // Start all the indexes into the model arrays at 0.
    var vertexIndex = 0;
    var textureCoordinatesIndex = 0;

    // Create StringParser
    var sp = new StringParser();

    // Break up the input lines into an array, one line per array element.
    var lines = dataString.split('\n');
    for ( lineIndex = 0; lineIndex < lines.length; lineIndex++) {

      sp.init(lines[lineIndex]);

      command = sp.getWord();

      if (command) {

        switch(command) {
          case '#':
            break;
          // Skip comments

          case 'mtllib':
            // The materials were already defined when the object counts were done.
            break;

          case 'o':
          case 'g':
            // Start of a new model definition.
            vertexIndex = 0;
            textureCoordinatesIndex = 0;

            // Read Object name
            modelName = sp.getWord();
            currentModel = findModel(modelName);
            //console.log("Filling arrays for model "+ modelName);
            break;

          case 'v':
            // Read vertex
            currentModel.vertices[vertexIndex++] = sp.getFloat() * scale;
            currentModel.vertices[vertexIndex++] = sp.getFloat() * scale;
            currentModel.vertices[vertexIndex++] = sp.getFloat() * scale;
            //console.log("vertex " + (vertexIndex-3) + ": " + currentModel.vertices[vertexIndex-3] + " " + currentModel.vertices[vertexIndex-2] + " " + currentModel.vertices[vertexIndex-1]);
            break;

          case 'vt':
            // Read texture coordinate
            currentModel.textureCoordinates[textureCoordinatesIndex++] = sp.getFloat();
            currentModel.textureCoordinates[textureCoordinatesIndex++] = sp.getFloat();
            //console.log("tex cor " + (textureCoordinatesIndex-2) + ": " + currentModel.textureCoordinates[textureCoordinatesIndex-2] + " " + currentModel.textureCoordinates[textureCoordinatesIndex-1]);
            break;

          case 'usemtl':
            // Read Material name
            materialName = sp.getWord();
            currentMaterial = findMaterial(materialName);
            break;

          case 'f':
            // Read face
            newFace = parseFace(sp, currentMaterial, currentModel, reverseNormals);
            currentModel.faces.push(newFace);
            /*
            console.log("face " + (currentModel.faces.length-1) + ": " + newFace.firstTriangleIndex + " " + newFace.numberTriangles);
            var w = newFace.firstTriangleIndex;
            for (var q=0; q<newFace.numberTriangles; q++) {
              console.log("  triangle indexes: " + currentModel.triangleIndexes[w++] + " " + currentModel.triangleIndexes[w++] + " " + currentModel.triangleIndexes[w++]);
              w = w - 3;
              console.log("  tex      indexes: " + currentModel.textureCoordinateIndexes[w++] + " " + currentModel.textureCoordinateIndexes[w++] + " " + currentModel.textureCoordinateIndexes[w++]);
            }
            */
            break;

        } // end switch
      } // end of if (command)
    }// end looping over each line

    return true;

  }

  //------------------------------------------------------------------------------
  function findFaces(model, vertex) {
    var faceIndex, start, last, k, allFaces;
    
    allFaces = [];
    for ( faceIndex = 0; faceIndex < model.faces.length; faceIndex++) {
      start = model.faces[faceIndex].firstTriangleIndex;
      last = start + model.faces[faceIndex].numberTriangles * 3;
      for ( k = start; k < last; k++) {
        if (vertex == model.triangleIndexes[k]) {
          allFaces.push(faceIndex);
          break;
        }
      }
    }
    return allFaces;
  }

  //------------------------------------------------------------------------------
  function arraysIdentical(a, b) {
    var i = a.length;
    if (i != b.length) {
      return false;
    }
    while (i--) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  }

  //------------------------------------------------------------------------------
  function removeDuplicates(allNormals) {
    var j, k;
    for (j = 0; j < allNormals.length; j++) {
      k = j+1;
      while (k < allNormals.length) {
        if (arraysIdentical(allNormals[j], allNormals[k])) {
          allNormals.splice(k, 1);
        } else {
          k++;
        }
      }
    }
    return allNormals;
  }

  //------------------------------------------------------------------------------
  function sumVectors(allVectors) {
    var sum, j, k, length;

    length = allVectors[0].length;
    sum = [];
    for ( j = 0; j < length; j++) {
      sum.push(0);
    }

    for ( k = 0; k < allVectors.length; k++) {
      for ( j = 0; j < length; j++) {
        sum[j] += allVectors[k][j];
      }
    }
    return sum;
  }

  //------------------------------------------------------------------------------
  function oneNormalAndColorPerVertex(model) {
    var v, j, k, n, allFaces, allNormals, allColors, normal, colors;

    // One normal and one color per vertex
    model.vertexColors = new Float32Array(model.numberVertices * 4);
    model.vertexNormals = new Float32Array(model.numberVertices * 3);

    for ( v = 0; v < model.numberVertices; v++) {
      // Find all the faces that use this vertex
      allFaces = findFaces(model, v);

      // Calculate the average normal vector and only allow duplicate normals to be counted once.
      allColors = [];
      allNormals = [];
      for ( j = 0; j < allFaces.length; j++) {
        k = allFaces[j];
        allNormals.push(model.faces[k].normalVector);
        allColors.push( model.faces[k].material.Kd );
      }
      
      // Calculate the average normal vector, ignoring duplicates
      allNormals = removeDuplicates(allNormals);
      normal = sumVectors(allNormals);
      normal = normalize(normal);

      // Calculate the average color, ignoring duplicates
      allColors = removeDuplicates(allColors);
      colors = sumVectors(allColors);
      if (allColors.length > 1) {
        colors[0] /= allColors.length;
        colors[1] /= allColors.length;
        colors[2] /= allColors.length;
        colors[3] /= allColors.length;
      }

      // store the values in the arrays.
      n = v * 3;
      model.vertexNormals[n] = normal[0];
      model.vertexNormals[n + 1] = normal[1];
      model.vertexNormals[n + 2] = normal[2];

      n = v * 4;
      model.vertexColors[n] = colors[0];
      model.vertexColors[n + 1] = colors[1];
      model.vertexColors[n + 2] = colors[2];
      model.vertexColors[n + 3] = colors[3];
    }
  }

  //------------------------------------------------------------------------------
  function createAndFillArrays(dataString, scale, reverseNormals) {
    var k, textOut;

    // Create the arrays needed to store each model.
    for ( k = 0; k < allModels.length; k++) {
      allModels[k].vertices = new Float32Array(allModels[k].numberVertices * 3);
      allModels[k].triangleIndexes = new Uint16Array(allModels[k].numberTriangles * 3);
      
      if (allModels[k].numberTextureCoordinates > 0) {
        allModels[k].textureCoordinates = new Float32Array(allModels[k].numberTextureCoordinates * 2);
        allModels[k].textureCoordinateIndexes = new Uint16Array(allModels[k].numberTriangles * 3);
        allModels[k].coloring = TEXTURED_MODEL;
      }
      
      allModels[k].faces = [];
    }

    // Now re-parse the OBJ data and copy the data into the correct arrays.
    fillModelArrays(dataString, scale, reverseNormals);

    // If SMOOTH_SHADING_MODEL, calculate the normal vectors and colors per vertex.
    for ( k = 0; k < allModels.length; k++) {
      if (allModels[k].shading == SMOOTH_SHADING_MODEL) {
        oneNormalAndColorPerVertex(allModels[k]);
      }
    }
    
  }


  //------------------------------------------------------------------------------
  function addTriangleVertex(model, vertexIndex, textureCoordinateIndex, faceIndex, dataArray, n) {
    var m;
    
    // Vertex x,y,z
    m = vertexIndex * 3;
    dataArray[n++] = model.vertices[m++];
    dataArray[n++] = model.vertices[m++];
    dataArray[n++] = model.vertices[m  ];
    //console.log("VOB vertex:(" + (m-2) + ") " + dataArray[n-3] + " " + dataArray[n-2] + " " + dataArray[n-1]);
    
    // Vertex normal vector
    if (model.shading == FLAT_SHADING_MODEL) {
      // Use the face normal
      dataArray[n++] = model.faces[faceIndex].normalVector[0];
      dataArray[n++] = model.faces[faceIndex].normalVector[1];
      dataArray[n++] = model.faces[faceIndex].normalVector[2];
      //console.log("VOB face normal: " + dataArray[n-3] + " " + dataArray[n-2] + " " + dataArray[n-1]);

      // Use the face color
      if (model.coloring == COLORED_MODEL || model.coloring == COLORED_AND_TEXTURED_MODEL) {
        dataArray[n++] = model.faces[faceIndex].material.Kd[0];
        dataArray[n++] = model.faces[faceIndex].material.Kd[1];
        dataArray[n++] = model.faces[faceIndex].material.Kd[2];
        dataArray[n++] = model.faces[faceIndex].material.Kd[3];
        //console.log("VOB face color: " + dataArray[n-4] + " " + dataArray[n-3] + " " + dataArray[n-2] + " " + dataArray[n-1]);
      }
    } else {// model.shading == SMOOTH_SHADING_MODEL
      // Use the vertex normal
      m = vertexIndex * 3;
      dataArray[n++] = model.vertexNormals[m++];
      dataArray[n++] = model.vertexNormals[m++];
      dataArray[n++] = model.vertexNormals[m];
      //console.log("VOB vertex normal: " + dataArray[n-3] + " " + dataArray[n-2] + " " + dataArray[n-1]);

      // Use the vertex color
      if (model.coloring == COLORED_MODEL || model.coloring == COLORED_AND_TEXTURED_MODEL) {
        m = vertexIndex * 4;
        dataArray[n++] = model.vertexColors[m++];
        dataArray[n++] = model.vertexColors[m++];
        dataArray[n++] = model.vertexColors[m++];
        dataArray[n++] = model.vertexColors[m];
        //console.log("VOB vertex color: " + dataArray[n-4] + " " + dataArray[n-3] + " " + dataArray[n-2] + " " + dataArray[n-1]);
      }
    }

    if (model.coloring == TEXTURED_MODEL || model.coloring == COLORED_AND_TEXTURED_MODEL) {
      m = textureCoordinateIndex * 2;
      dataArray[n++] = model.textureCoordinates[m++];
      dataArray[n++] = model.textureCoordinates[m++];
      //console.log("VOB tex coords:(" + (m-2) + ") " + textureCoordinateIndex + "  " + dataArray[n-2] + " " + dataArray[n-1]);
    }
    return n;
  }

  //------------------------------------------------------------------------------
  function addTriangle(model, i0, i1, i2, t0, t1, t2, faceIndex, dataArray, n) {
    n = addTriangleVertex(model, i0, t0, faceIndex, dataArray, n);
    n = addTriangleVertex(model, i1, t1, faceIndex, dataArray, n);
    n = addTriangleVertex(model, i2, t2, faceIndex, dataArray, n);
    return n;
  }

  //------------------------------------------------------------------------------
  function createVOB(model) {
    var vertexIndex, n, faceIndex, t;
    var i0, i1, i2;    
    var t0, t1, t2;   // texture coordinate indexes
    var numberVertices = model.numberTriangles * 3;
    var floatsPerVertex;

    t0 = 0;
    t1 = 0;
    t2 = 0;
    
    // Calculate the size of the VOB.
    switch( model.coloring ) {
      case COLORED_MODEL:
        floatsPerVertex = 10;
        break;
      case TEXTURED_MODEL:
        floatsPerVertex = 8;
        break;
      case COLORED_AND_TEXTURED_MODEL:
        floatsPerVertex = 12;
        break;
    }
    

    // Create the interleaved data array for the model
    var dataArray = new Float32Array(floatsPerVertex * numberVertices);

    // Move the model data into the dataArray, one face at a time
    n = 0;
    for ( faceIndex = 0; faceIndex < model.faces.length; faceIndex++) {
      // Index into the vertexIndexes array for the start of the triangle vertex indexes
      k = model.faces[faceIndex].firstTriangleIndex;
      
      // Build the triangles
      for (t=0; t<model.faces[faceIndex].numberTriangles; t++) {
        i0 = model.triangleIndexes[k++];
        i1 = model.triangleIndexes[k++];
        i2 = model.triangleIndexes[k++];

        if (model.coloring > COLORED_MODEL) {
          k -= 3;
          t0 = model.textureCoordinateIndexes[k++];
          t1 = model.textureCoordinateIndexes[k++];
          t2 = model.textureCoordinateIndexes[k++];
        }
        
        n = addTriangle(model, i0, i1, i2, t0, t1, t2, faceIndex, dataArray, n);
        //console.log("Add triangle: " + t + " indexes: " + i0 + " " + i1 + " " + i2 + "  tex: " + t0 + " " + t1 + " " + t2);
      }
    }

    model.VOB = dataArray;
  }

  //------------------------------------------------------------------------------
  function setWebGLBuffer(model) {
    
    // Create a buffer object
    var buffer = gl.createBuffer();
    if (!buffer) {
      console.log('Failed to create the buffer object for ' + model.name);
      return null;
    }

    // Make the buffer object the active buffer.
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

    // Upload the data for this buffer object.
    gl.bufferData(gl.ARRAY_BUFFER, model.VOB, gl.STATIC_DRAW);

    // Remember the buffer so it can be used for rendering.
    model.bufferID = buffer;
  }

  //------------------------------------------------------------------------------
  // body of createModels3D(gl, program, dataString, scale, reverseNormals)

  // Step 0: Get the OBJ data of the model from the HTML object that contains it.
  dataString = null;
  var htmlObject = document.getElementById(fileName+'_obj');
  if (htmlObject) {
    htmlObject = htmlObject.contentDocument;
    
    if (htmlObject) {
      // Google Chrome location of data
      dataString = htmlObject.body.innerText;
      if (! dataString && htmlObject.body.textContent) {
        // Try the Firefox way
        dataString = htmlObject.body.textContent;
      }
    }
  }
  
  if (! dataString) {
    console.log('ERROR: Model ' + fileName+'_obj' + ' could not be created. Make sure it is being loaded in the HTML file.');
    return [];
  }
  
  // Step 1: Count the number of basic elements in each model.
  countElements(gl, program, dataString);

  // Step 2: Create the correct size arrays and transfer the model data into them.
  createAndFillArrays(dataString, scale, reverseNormals);

  // Step 3: Create the VOB (vertex object buffer) for each of the 3D models that was created.
  for ( modelIndex = 0; modelIndex < allModels.length; modelIndex++) {
    //console.log("Create VOB for model: " + modelIndex);
    createVOB( allModels[modelIndex] );
    setWebGLBuffer( allModels[modelIndex] );
  }

  // Display the models that were created to the console window.
  // This can be comments out is you don't want the confirmation.
  var textout = "Created models: ";
  for ( var k = 0; k < allModels.length; k++) {
    console.log("Created " + fileName + ": " 
                + allModels[k].modelName + " has "
                + allModels[k].numberTriangles + " triangles, "
                + (allModels[k].numberTriangles*3) + " vertices, "
                + "Vertex object buffer (VOB) is " + allModels[k].VOB.length + " bytes");
  }
    
  // Return an array of Model3D objects.
  return allModels;
}


