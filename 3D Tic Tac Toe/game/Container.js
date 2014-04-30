// Container.js - By: Dr. Wayne Brown, March 2014
// Defines a container for widgets.

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
 * Definition of a container - a 3D array of widget cubes
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
   * Create the Container and initialize it to be empty
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
    for (y = 0; y < this.yDim; y++) {
      this.Array[y] = [];
      for (x = 0; x < this.xDim; x++) {
        this.Array[y][x] = [];
        for (z = 0; z < this.zDim; z++) {
          this.Array[y][x][z] = null;
        }
      }
    }
  }
  
  //------------------------------------------------------------------------------
  /*
   * Add a widget to the container.
   * @param widgetModels: an array of models that define the widget
   * @param centers: an array of vec4 positions that define the center point of 
   *                 each cube in the widget
   * @param transform: a Matrix4 that defines the position and orientation of 
   *                   the widget in the container
   * @return true if the widget was added to the container; false if the widget
   *         could not be added to the container.
   */
  this.addWidget = function(widgetModels, transform, x, y, z) {
    
    // Make a copy of the transform so that the origin has no effect on this widget.
    var cubeTransform = new Matrix4(transform);
      
    for (j = 0; j < widgetModels.length; j++) {
      // Remember this cube and its transform at this location in the container.
      this.Array[y][x][z] = new ContainerCube(widgetModels[j], cubeTransform);
    }
    
    // Return true because the widget was successfully added to the container.
    return true;
  }

  

  this.changeModel = function(model, x, y, z){
    for (j = 0; j < model.length; j++) {
      // Remember this cube and its transform at this location in the container.
      this.Array[z][x][y].model = model[j];
    }    
  }
  

  //------------------------------------------------------------------------------
  /*
   * Draw all the cubes that are currently in the container.
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
    for (y = 0; y < this.yDim; y++) {
      for (x = 0; x < this.xDim; x++) {
        for (z = 0; z < this.zDim; z++) {
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
}