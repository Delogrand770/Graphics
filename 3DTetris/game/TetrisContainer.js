// TetrisContainer.js - By: Dr. Wayne Brown, March 2014
// Defines a container for Tetris widgets to fall into.

//==============================================================================
/*
 * An object that stores a single cube model and a transform to render it at
 * a specific location and orientation.
 */
var ContainerCube = function(model, transform) {
  // Remember the model
  this.model = model;
  // Remember the transformation matrix that will draw the model in its correct 
  // location and orientation.
  this.matrixTransform = transform;
}

//==============================================================================
/*
 * Definition of a Tetris container - a 3D array of widget cubes
 */
var TetrisContainer = function() {

  // The dimensions of the container along each axis.
  this.xDim;
  this.yDim;
  this.zDim;
  
  // Offsets from 3D widget center coordinates to array indexes
  this.xOffset;
  this.yOffset;
  this.zOffset;
  
  // A 3D array that holds references to the widget cubes in the container.
  this.Array; 

  //------------------------------------------------------------------------------
  /*
   * Create the TetrisContainer and initialize it to be empty
   * @param xUnits: the number of cube positions along the x axis
   * @param yUnits: the number of cube positions along the y axis
   * @param zUnits: the number of cube positions along the z axis
   * @param xOffset: this is added to a cube location in 3D space to create a 
   *                 3D array index
   * @param yOffset: this is added to a cube location in 3D space to create a 
   *                 3D array index
   * @param zOffset: this is added to a cube location in 3D space to create a 
   *                 3D array index
   */
  this.create = function(xUnits, yUnits, zUnits, xOffset, yOffset, zOffset) {
    var x,y,z;
    
    this.xDim = xUnits;
    this.yDim = yUnits;
    this.zDim = zUnits;
    
    this.xOffset = xOffset;
    this.yOffset = yOffset;
    this.zOffset = zOffset;
    
    // Create an empty 3D array
    this.Array  = [];
    for (y = 0; y<this.yDim; y++) {
      this.Array[y] = [];
      for (x=0; x<this.xDim; x++) {
        this.Array[y][x] = [];
        for (z=0; z<this.zDim; z++) {
          this.Array[y][x][z] = null;
        }
      }
    }
  }
  
  //------------------------------------------------------------------------------
  /*
   * Add a widget to the Tetris container.
   * @param widgetModels: an array of models that define the widget
   * @param centers: an array of vec4 positions that define the center point of 
   *                 each cube in the widget
   * @param transform: a Matrix4 that defines the position and orientation of 
   *                   the widget in the container
   * @return true if the widget was added to the container; false if the widget
   *         could not be added to the container.
   */
  this.addWidget = function(widgetModels, centers, transform) {
    var j, x, y, z;
    var v;
    
    // Make a copy of the transform so that the origin has no effect on this widget.
    var cubeTransform = new Matrix4(transform);
      
    for (j=0; j<widgetModels.length; j++) {
      // Transform the center of the model to its location in 3D space.
      v = transform.multiplyVector4(centers[j]);
      
      // Convert the center point into array indexes.
      x = Math.round(v.elements[0] + this.xOffset);
      y = Math.round(v.elements[1] + this.yOffset);
      z = Math.round(v.elements[2] + this.zOffset);
      
      // Make sure this is a valid position in the container.
       if (x < 0 || x >= this.xDim || 
           y < 0 || y >= this.yDim || 
           z < 0 || z >= this.zDim) {
        // The cube is not inside the containter, so quite and return false.
        return false;
      }
     
      // Remember this cube and its transform at this location in the container.
      this.Array[y][x][z] = new ContainerCube(widgetModels[j], cubeTransform);
    }
    
    // Return true because the widget was successfully added to the container.
    return true;
  }
  
  //------------------------------------------------------------------------------
  /*
   * Determine if a widget can be at the location defined by the transform.
   * @param centers: an array of vec4 positions that define the center point of 
   *                 each cube in the widget
   * @param transform: a Matrix4 that defines the position and orientation of 
   *                   the widget in the container
   * @return true if the widget under the specified transform has all of its 
   *         cubes inside the contanier and all of the positions of the 
   *         cubes in the container are empty;
   *         false if any cubes of the widget are outside the container or 
   *         occupy a position that is already taken.
   */
  this.widgetLocationIsValid = function(centers, transform) {
    var j, x, y, z;
    var v;
    
    for (j=0; j<centers.length; j++) {
      // Transform the center of the model to its location in 3D space.
      v = transform.multiplyVector4(centers[j]);
      
      // Convert the center point into array indexes.
      x = Math.round(v.elements[0] + this.xOffset);
      y = Math.round(v.elements[1] + this.yOffset);
      z = Math.round(v.elements[2] + this.zOffset);
      
      // Check to make sure the cube is inside the container. It is important
      // to do this test first to make sure the array indexes are valid.
      if (x < 0 || x >= this.xDim || y < 0 || z < 0 || z >= this.zDim) {
        return false;
      }
      
      // Check to make sure the cube position is not already occupied.
      if (y < this.yDim && this.Array[y][x][z]) {
        return false;
      }

    }
    
    // All cubes of the widget are inside the container and in empty locations.
    return true;
  }
  
  //------------------------------------------------------------------------------
  /*
   * Draw all the cubes that are currently in the Tetris container.
   * @param projectionCameraModelMatrix: a Matrix4 that contains the project, 
   *             camera, and model transforms.
   * @param gl: the gl context for rendering
   * @param program: the program context, including shader varaible locations.
   */
  this.draw = function(projectionCameraModelMatrix, gl, program) {
    var x,y,z;
    var cube;
    var cubeTransform = new Matrix4();
    
    // For every position in the container...
    for (y = 0; y<this.yDim; y++) {
      for (x=0; x<this.xDim; x++) {
        for (z=0; z<this.zDim; z++) {
          cube = this.Array[y][x][z];
          if (cube) {
            // Make a copy of the project, camera, model transform
            cubeTransform.set(projectionCameraModelMatrix);
            
            // Concatenate the model transform onto the transformation
            cubeTransform.multiply(cube.matrixTransform);
            
            // Set the shader's tranformation matrix
            gl.uniformMatrix4fv(program.u_TransformMatrix, false, cubeTransform.elements);

            // Draw the cube
            cube.model.draw(gl, program);
          }
        }
      }
    }
  }

  //------------------------------------------------------------------------------
  /*
   * Determine if a level in the container is full.
   * @param level: the level to check
   * @return true if every position in the level contains a cube, false otherwise.
   */
  this.levelIsFull = function(level) {
    var x,z;
    
    // Get the specified level
    var thisLevel = this.Array[level];
    
    // Return false if one element in the level is null
    for (x=0; x<this.xDim; x++) {
      for (z=0; z<this.zDim; z++) {
        if (thisLevel[x][z] == null) {
          //console.log("level " + level + " is not full because " + x + " " + z + " is null.");
          return false;
        }
      }
    }
    
    // Every element in the level references a cube, so the level is full
    //console.log("level " + level + " is full");
    return true;
  }
  
  //------------------------------------------------------------------------------
  /*
   * Remove all the cubes on the specified level by shifting all the levels 
   * above it down one level.
   * @param startLevel: the level to be removed.
   */
  this.shiftLevelsDown = function(startLevel) {
    var x,y,z;
    
    // There must be two levels to be able to shift down.
    if (startLevel == this.yDim-1) return;
    
    y = startLevel;
    while (y < this.yDim-1) {
      // move all the elements in the aboveLevel to the level.
      for (x=0; x<this.xDim; x++) {
        for (z=0; z<this.zDim; z++) {
          // Copy the above value down.
          this.Array[y][x][z] = this.Array[y+1][x][z];
          
          // Null out the value just copied.
          this.Array[y+1][x][z] = null;
        }
      }
      y++;
    }
   }
  
  //------------------------------------------------------------------------------
  /*
   * Remove any level in the container that is full.
   */
  this.removeFullLevels = function() {
    var y;
    
    y = 0;
    while (y<this.yDim) {
      if ( this.levelIsFull(y) ) {
        this.shiftLevelsDown(y);
      } else {
        y++;
      }
    }
  }
}