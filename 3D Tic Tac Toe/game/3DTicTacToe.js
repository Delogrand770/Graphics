// 3DTetris.js - By: Dr. Wayne Brown, Jan. 2014
// This version uses absolute transformations which create a new
// transformation matrix for the modelMatrix on each user command.

// Require all variables to be defined before they are used.

// Declare all variables used in this program. The allows the interpreter 
// to generate errors on miss-spelled and miss-used variables.
var getWebGLContext, initShaders, console, createModels3D, 
    Matrix4, AxesModel, BoxModel, WidgetModel, myViewer;
    
//---------------------------------------------------------------------
function myMouseDragStarted(e) {
  // Only allow mouse movement to change the camera if the initial click is 
  // inside the canvas area.
  var bounds = myGame.canvas.getBoundingClientRect();
  if (e.x >= bounds.left && e.x <= bounds.right &&
      e.y >= bounds.top  && e.y <= bounds.bottom) {
    // Start the drag operation
    myGame.startOfMouseDrag = e;
    
    // Don't allow the mouse to scroll the window
    document.body.style.overflow = 'hidden';
  }
}

//---------------------------------------------------------------------
function myMouseDragEnded(e) {  
  // Stop the draw operation
  myGame.startOfMouseDrag = null;
  
  // Allow the mouse to scroll the window
  document.body.style.overflow = 'visible';
}

//---------------------------------------------------------------------
function myMouseDragged(e) {
  if (myGame.startOfMouseDrag && myGame.cameraMode > 0) {    
    var deltaX = e.x - myGame.startOfMouseDrag.x;
    var deltaY = e.y - myGame.startOfMouseDrag.y;

    if (myGame.cameraMode == 1){
    	myGame.panCamera(deltaX, deltaY);
    } else if (myGame.cameraMode == 2){
    	myGame.tiltCamera(deltaX, deltaY);
    } else if (myGame.cameraMode == 3){
    	myGame.pedestalCamera(deltaX, deltaY);
    } else if (myGame.cameraMode == 4){
    	myGame.tougeCamera(deltaX, deltaY);
    } else if (myGame.cameraMode == 5){
    	myGame.craneCamera(deltaX, deltaY);
    } else if (myGame.cameraMode == 6){
    	myGame.dollyCamera(deltaX, deltaY);
    } else if (myGame.cameraMode == 7){
    	myGame.trunkCamera(deltaX, deltaY);
    } else if (myGame.cameraMode == 8){
    	myGame.arcCamera(deltaX, deltaY);
    } else if (myGame.cameraMode == 9){
    	myGame.cantCamera(deltaX, deltaY);
    } else if (myGame.cameraMode == 11){
    	myGame.arcCameraUD(deltaX, deltaY);
    	myGame.arcCameraLR(deltaX, deltaY);
    }

    myGame.draw();
    
    myGame.startOfMouseDrag = e;
  }
}

//------------------------------------------------------------------------------
var TicTacToe3D = function() {
  
  // Environment variables
  this.canvas = null;
  this.gl = null;
  this.program = null;
  
  // Graphic 3D models to render
  this.myWidgets = [];
  
  // Transformations for rendering the models. We keep the transformations
  // separate, but combine them into a single transform before we render
  // to make the rendering as fast as possible.
  this.projectionMatrix = new Matrix4();
  this.viewMatrix       = new Matrix4();
  this.modelMatrix      = new Matrix4();
  this.identityModelMatrix = new Matrix4();
  // The combination of the projection, camera view, and model transforms
  this.combinedMatrix   = new Matrix4();
  // Calculate the inverse of the modelMatrix to get the direction
  // of the global axes.
  this.modelMatrixInverse = new Matrix4();

  this.gameOver;
  
  // A container to hold the widgets that have finished falling.
  this.container;

  // Projection modes
  this.ORTHOGRAPHIC_PROJECTION = 0;
  this.PERSPECTIVE_PROJECTION  = 1;
  this.projectionMode = this.PERSPECTIVE_PROJECTION;
  
  // Camera Values
  this.cameraMode = 11;
  this.startOfMouseDrag = null;
  this.eye = [19.5, 19.5, 19.5];
  this.at = [1.0, 2.0, 0.0];
  this.upVector = [0.0, 1.0, 0.0];
  this.eyeDefault = this.eye.slice(0);
  this.atDefault = this.at.slice(0);
  this.upVectorDefault = this.upVector.slice(0);
  
  // Camera coordinate system
  this.u = [];
  this.v = [];
  this.n = [];
  
  // Camera manipulation increments
  this.ROTATE_ANGLE = 0.3;  // in degrees
  this.OFFSET_CAMERA = 0.1;
  this.BOOM_LENGTH = 20.0;
  this.boomAngle = 0.0;
  this.boomBase = [0,0,0];

  //------------------------------------------------------------------------------
  this.init = function() {

    // Retrieve <canvas> element
    this.canvas = document.getElementById('GameWindow');

    // Add the mouse event handlers to the document so that mouse movement and
    // button presses and releases are recognized in the entire window.
    document.addEventListener('mousedown', myMouseDragStarted, false);
    document.addEventListener('mousemove', myMouseDragged, false);
    document.addEventListener('mouseup', myMouseDragEnded, false);

    // Get the rendering context for WebGL
    this.gl = getWebGLContext(this.canvas, true);
    if (!this.gl) {
      console.log('Fatal error: Failed to get the rendering context for WebGL');
      return;
    }

    // Initialize shaders
    var vertexShaderText = document.getElementById("myVertexShader").innerHTML;
    var fragmentShaderText = document.getElementById("myFragmentShader").innerHTML;
    if (!initShaders(this.gl, vertexShaderText, fragmentShaderText)) {
      console.log('Fatal error: Failed to intialize shaders.');
      return;
    }

    // Set the clear color and enable the depth test
    this.gl.clearColor(0.7, 0.7, 0.7, 1.0);
    this.gl.enable(this.gl.DEPTH_TEST);

    // Get the storage locations of attribute and uniform variables
    var program = this.gl.program;
    program.a_Position = this.gl.getAttribLocation(program, 'a_Position');
    program.a_Color = this.gl.getAttribLocation(program, 'a_Color');
    program.a_TexCoord = this.gl.getAttribLocation(program, 'a_TexCoord');
    program.a_Normal = this.gl.getAttribLocation(program, 'a_Normal');

    program.colorMode = this.gl.getUniformLocation(program, 'colorMode');
    program.u_TransformMatrix = this.gl.getUniformLocation(program, 'u_TransformMatrix');
    program.u_Sampler = this.gl.getUniformLocation(program, 'u_Sampler');
    program.u_ModelMatrix = this.gl.getUniformLocation(program, 'u_ModelMatrix');
    program.u_LightColor = this.gl.getUniformLocation(program, 'u_LightColor');
    program.u_LightPosition = this.gl.getUniformLocation(program, 'u_LightPosition');
    program.u_AmbientLight = this.gl.getUniformLocation(program, 'u_AmbientLight');

    if (program.a_Position < 0     ||
        program.a_Normal < 0       ||
        program.a_TexCoord < 0     ||
        program.a_Color < 0        ||
        !program.colorMode         ||
        !program.u_TransformMatrix ||
        !program.u_ModelMatrix     ||
        !program.u_Sampler         ||
        !program.u_LightColor      ||
        !program.u_LightPosition   ||
        !program.u_AmbientLight) {
      console.log('Fatal error: failed to get the shader variable locations.');
      return;
    }

    var lightColor = new Float32Array([1.0, 1.0, 1.0]);
    this.lightPosition = new Float32Array([50.0, 40.0, 50.0]);
    var ambientLight = new Float32Array([0.4, 0.4, 0.4]);

    this.gl.uniform3fv(program.u_LightColor, lightColor);
    this.gl.uniform3fv(program.u_LightPosition, this.lightPosition);
    this.gl.uniform3fv(program.u_AmbientLight, ambientLight);

    // Create the 3D models from .obj data. The parameter must be a string that contains the OBJ data.
    this.myWidgets.push(createModels3D(this.gl, program, 'e', 1, true));
    this.myWidgets.push(createModels3D(this.gl, program, 'x', 1, true));
    this.myWidgets.push(createModels3D(this.gl, program, 'o', 1, true));
    this.myWidgets.push(createModels3D(this.gl, program, 'w', 1, true));

    for (var i = 0; i < this.myWidgets.length; i++){
    	if (!this.myWidgets[i]){
    		console.log("Fatal error: Could not create the models.");
      	return;
    	}
    }

    // Create a projection from 3D space to a 2D screen.
    this.setProjection();

    // Create a view of the world. This transform positions the camera.
    this.viewMatrix.setIdentity();
    this.viewMatrix.lookAt(20.0, 16.0, 16.0, 0.0, 2.0, 0.0, 0.0, 1.0, 0.0);
    
    this.container = new TetrisContainer();
    this.container.create(3,3,3,0,0,0);

    this.fillContainer();

    this.gameOver = false;

    myGame.modelMatrix.setIdentity();

    //this.container.changeModel(this.myWidgets[1], 0, 0, 0);
    myGame.panCamera(0,0);
    myGame.draw();

    this.tick();
  };
  
  this.fillContainer = function(){
  	var spacing = 2.5;
  	var xOffset = 0;
  	var yOffset = -5.5;
  	var zOffset = 0;
    for (z = 0; z < this.container.zDim; z++) {
      for (y = 0; y < this.container.yDim; y++) {
        for (x = 0; x < this.container.xDim; x++) {
					this.buildModelMatrix(spacing * z - zOffset, -spacing * y - yOffset, spacing * x - xOffset);
    			this.container.addWidget(this.myWidgets[0], this.modelMatrix, z, y, x);
				}
			}
		}
  }

  //------------------------------------------------------------------------------
  // Animation function, which drops the widget 1 unit on the y axis each second.
  this.tick = function() {
     myGame.draw();
    
    // Request that the browser call tick
    requestAnimationFrame(myGame.tick); 
  };

  this.reset = function() {
  	myGame = new TicTacToe3D();
  	myGame.init();
  }
  
  //------------------------------------------------------------------------------
  this.draw = function() {

    var j;
    var program = this.gl.program;
    
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    // Step 1: clear the graphics window -- and depth buffers
    this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    // Step 2: Draw the objects that don't move. This includes the open  
    // container and the global axes. The only transformation is for the 
    // camera and projection.
    this.combinedMatrix.setIdentity();
    this.combinedMatrix.multiply(this.projectionMatrix);
    this.combinedMatrix.multiply(this.viewMatrix);
    
    this.gl.uniformMatrix4fv(program.u_TransformMatrix, false, this.combinedMatrix.elements);
    this.gl.uniformMatrix4fv(program.u_ModelMatrix, false, this.identityModelMatrix.elements);

    this.container.draw(this.combinedMatrix, this.gl, program);

    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    // Step 3: Now draw the objects that move. This requires appending the 
    // transformations we want to apply to the model onto the camera and projection
    // transforms.    
    this.combinedMatrix.multiply(this.modelMatrix);
    
    this.gl.uniformMatrix4fv(program.u_TransformMatrix, false, this.combinedMatrix.elements);
    this.gl.uniformMatrix4fv(program.u_ModelMatrix, false, this.modelMatrix.elements);

  };

  //------------------------------------------------------------------------------
  this.startOver = function() {
    alert("start game over");
  };

  //------------------------------------------------------------------------------
  this.myKeyEvent = function(event) {

    //alert(event.keyCode);
  };

  //------------------------------------------------------------------------------
  this.buildModelMatrix = function(x, y, z) {
    this.modelMatrix.setIdentity();
    
    // translate to the correct location
    this.modelMatrix.translate(x, y, z);
  }
  
  //------------------------------------------------------------------------------
  this.setProjectionMode = function(mode) {
    this.projectionMode = mode;
    this.setProjection();
    this.draw();
  };
  
  //------------------------------------------------------------------------------
  this.setProjection = function() {
    switch (this.projectionMode) {
      case this.ORTHOGRAPHIC_PROJECTION:
        var left = -8.0;
        var right = -left;
        var canvasRatio = this.canvas.width / this.canvas.height;
        var height = (right - left) / canvasRatio;
        var top = height / 2.0;
        var bottom = -top;
        this.projectionMatrix.setOrtho(left, right, bottom, top, 1.0, 150.0);
        break;
        
      case this.PERSPECTIVE_PROJECTION:
        this.projectionMatrix.setPerspective(30.0, this.canvas.width / this.canvas.height, 1.0, 150.0);
        break;
    }
  };
  
  //------------------------------------------------------------------------------
  this.setCameraMode = function(mode) {
    this.cameraMode = mode;
    if (mode == 10) {
      this.resetCamera();
      this.draw();
    }
    if (mode == 4 || mode == 5) {
      this.calculateBoomBase();
    }
  };

  //------------------------------------------------------------------------------
  this.panCamera = function(deltaX, deltaY) {
    this.calculateCameraCoordinateSystem();
    
    // The amount of rotation is controled by the size of deltaX
    var angle = this.ROTATE_ANGLE * deltaX;
    
    // Rotate about the eye using the v vector as the axis of rotation
    var m = new Matrix4();
    m.setIdentity();
    m.rotate(angle, this.v[0], this.v[1], this.v[2]);
    
    var nVec4 = new Vector4([-this.n[0], -this.n[1], -this.n[2], 0.0]);    
    var nNewVec4 = m.multiplyVector4(nVec4);
    var nNew = [nNewVec4.elements[0], nNewVec4.elements[1], nNewVec4.elements[2]];
    
    var eyeToAtDistance = this.distance( this.eye, this.at);
    this.scale(nNew, eyeToAtDistance);
    this.add(this.eye, nNew, this.at);
    
    this.setCamera();
  };
  
  //------------------------------------------------------------------------------
  this.tiltCamera = function(deltaX, deltaY) {
    this.calculateCameraCoordinateSystem();
    
    // The amount of rotation is controled by the size of deltaY
    var angle = this.ROTATE_ANGLE * deltaY;
    
    // Rotate about the eye using the u vector as the axis of rotation
    var m = new Matrix4();
    m.setIdentity();
    m.rotate(angle, this.u[0], this.u[1], this.u[2]);
    
    var nVec4 = new Vector4([-this.n[0], -this.n[1], -this.n[2], 0.0]);    
    var nNewVec4 = m.multiplyVector4(nVec4);
    var nNew = [nNewVec4.elements[0], nNewVec4.elements[1], nNewVec4.elements[2]];
    
    var eyeToAtDistance = this.distance( this.eye, this.at);
    this.scale(nNew, eyeToAtDistance);
    this.add(this.eye, nNew, this.at);
    
    this.setCamera();    
  };
  
  //------------------------------------------------------------------------------
  this.pedestalCamera = function(deltaX, deltaY) {
    this.calculateCameraCoordinateSystem();
    
    // The amount of rotation is controled by the size of deltaY
    var distance = this.OFFSET_CAMERA * deltaY;

    this.scale(this.v, distance);
    this.add(this.eye, this.v, this.eye);
    this.add(this.at, this.v, this.at);
    
    this.setCamera();    
  };
  
  //------------------------------------------------------------------------------
  this.calculateBoomBase = function() {
    this.calculateCameraCoordinateSystem();

    // Calculate the current location of the boom base
    // (go in the n direction along the angle of the boom.)
    // Create a vector in the n direction that is parallel to the ground
    var nHorizontal = [this.n[0], 0.0, this.n[2]];
    this.normalize(nHorizontal);
    this.scale(nHorizontal, this.BOOM_LENGTH);
    
    var m = new Matrix4();
    m.setIdentity();
    m.rotate(this.boomAngle, this.u[0], this.u[1], this.u[2]);
    
    var bVec4 = new Vector4([nHorizontal[0], nHorizontal[1], nHorizontal[2], 0.0]);    
    var bNewVec4 = m.multiplyVector4(bVec4);
    var bNew = [bNewVec4.elements[0], bNewVec4.elements[1], bNewVec4.elements[2]];
    
    this.add(this.eye, bNew, this.boomBase);
  };
  
  //------------------------------------------------------------------------------
  this.tougeCamera = function(deltaX, deltaY) {
    this.calculateCameraCoordinateSystem();
    
    // Rotate the boom deltaY amount about the u axis.
    this.boomAngle += this.ROTATE_ANGLE * -deltaX;

    var m = new Matrix4();
    m.setIdentity();
    m.rotate(this.boomAngle, this.upVector[0], this.upVector[1], this.upVector[2]);

    var nHorizontal = [-this.n[0], 0.0, -this.n[2]];
    this.normalize(nHorizontal);
    this.scale(nHorizontal, this.BOOM_LENGTH);

    var bVec4 = new Vector4([nHorizontal[0], nHorizontal[1], nHorizontal[2], 0.0]);    
    var bNewVec4 = m.multiplyVector4(bVec4);
    var bNew = [bNewVec4.elements[0], bNewVec4.elements[1], bNewVec4.elements[2]];
    
    // Calculate the new location of the eye
    this.add(this.boomBase, bNew, this.eye);
    
    this.setCamera();
  };
  
  //------------------------------------------------------------------------------
  this.craneCamera = function(deltaX, deltaY) {
    this.calculateCameraCoordinateSystem();
    
    // Rotate the boom deltaY amount about the u axis.
    this.boomAngle += this.ROTATE_ANGLE * -deltaY;
    var m = new Matrix4();
    m.setIdentity();
    m.rotate(this.boomAngle, this.u[0], this.u[1], this.u[2]);

    var nHorizontal = [-this.n[0], 0.0, -this.n[2]];
    this.normalize(nHorizontal);
    this.scale(nHorizontal, this.BOOM_LENGTH);

    var bVec4 = new Vector4([nHorizontal[0], nHorizontal[1], nHorizontal[2], 0.0]);    
    var bNewVec4 = m.multiplyVector4(bVec4);
    var bNew = [bNewVec4.elements[0], bNewVec4.elements[1], bNewVec4.elements[2]];
    
    // Calculate the new location of the eye
    this.add(this.boomBase, bNew, this.eye);
    
    this.setCamera();
  };
  
  //------------------------------------------------------------------------------
  this.dollyCamera = function(deltaX, deltaY) {
    this.calculateCameraCoordinateSystem();
    
    // save the eye position in case it has to be reset
    var eyeSaved = this.eye.slice(0);
    var amount;
    
    // The amount of translation is controled by the maximum of the 2 deltas
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      amount = deltaX;
    } else {
      amount = -deltaY;
    }
    var distance = this.OFFSET_CAMERA * amount;

    this.scale(this.n, -distance);
    this.add(this.eye, this.n, this.eye);

    // Don't allow the eye to move past the at position or less than 1 unit to it.
    var eyeToAtDistance = this.distance( this.eye, this.at);
    if (eyeToAtDistance < 1.0) {
      this.eye = eyeSaved.slice(0);
    } else {
      this.setCamera();    
    }
  };
  
  //------------------------------------------------------------------------------
  this.trunkCamera = function(deltaX, deltaY) {
    this.calculateCameraCoordinateSystem();
    
    // The amount of translation is controled by the size of deltaX
    var distance = -this.OFFSET_CAMERA * deltaX;

    this.scale(this.u, distance);
    this.add(this.eye, this.u, this.eye);
    this.add(this.at, this.u, this.at);
    
    this.setCamera();    
  };
  
  //------------------------------------------------------------------------------
  this.arcCameraLR = function(deltaX, deltaY) {
    this.calculateCameraCoordinateSystem();
    
    // The amount of rotation is controled by the size of deltaY
    var angle = this.ROTATE_ANGLE * deltaX;
    
    // Rotate about the eye using the upVector vector as the axis of rotation
    var m = new Matrix4();
    m.setIdentity();
    m.rotate(-angle, 0, 1, 0);
    
    var nVec4 = new Vector4([this.n[0], this.n[1], this.n[2], 1.0]);    
    var nNewVec4 = m.multiplyVector4(nVec4);
    var nNew = [nNewVec4.elements[0], nNewVec4.elements[1], nNewVec4.elements[2]];
    
    var eyeToAtDistance = this.distance( this.eye, this.at);
    this.scale(nNew, eyeToAtDistance);
    this.add(this.at, nNew, this.eye);
    
    this.setCamera();
  };

  //------------------------------------------------------------------------------
  this.arcCameraUD = function(deltaX, deltaY) {
    this.calculateCameraCoordinateSystem();
    
    // The amount of rotation is controled by the size of deltaY
    var angle = this.ROTATE_ANGLE * deltaY;
    
    // Rotate about the eye using the upVector vector as the axis of rotation
    var m = new Matrix4();
    m.setIdentity();
    m.rotate(-angle, 1, 0, -1);
    
    var nVec4 = new Vector4([this.n[0], this.n[1], this.n[2], 1.0]);    
    var nNewVec4 = m.multiplyVector4(nVec4);
    var nNew = [nNewVec4.elements[0], nNewVec4.elements[1], nNewVec4.elements[2]];
    
    var eyeToAtDistance = this.distance( this.eye, this.at);
    this.scale(nNew, eyeToAtDistance);
    this.add(this.at, nNew, this.eye);
    
    this.setCamera();
  };

   //------------------------------------------------------------------------------
  this.arcCamera = function(deltaX, deltaY) {
    this.calculateCameraCoordinateSystem();
    
    // The amount of rotation is controled by the size of deltaY
    var angle = this.ROTATE_ANGLE * deltaX;
    
    // Rotate about the eye using the upVector vector as the axis of rotation
    var m = new Matrix4();
    m.setIdentity();
    m.rotate(angle, this.upVector[0], this.upVector[1], this.upVector[2]);
    
    var nVec4 = new Vector4([this.n[0], this.n[1], this.n[2], 0.0]);    
    var nNewVec4 = m.multiplyVector4(nVec4);
    var nNew = [nNewVec4.elements[0], nNewVec4.elements[1], nNewVec4.elements[2]];
    
    var eyeToAtDistance = this.distance( this.eye, this.at);
    this.scale(nNew, eyeToAtDistance);
    this.add(this.at, nNew, this.eye);
    
    this.setCamera();    
  };
  
  //------------------------------------------------------------------------------
  this.cantCamera = function(deltaX, deltaY) {
    this.calculateCameraCoordinateSystem();
    
    // The amount of rotation is controled by the size of deltaX
    var angle = this.ROTATE_ANGLE * deltaX;
    
    // Rotate about the eye using the n vector as the axis of rotation
    var m = new Matrix4();
    m.setIdentity();
    m.rotate(angle, this.n[0], this.n[1], this.n[2]);
    
    var upVec4 = new Vector4([this.upVector[0], this.upVector[1], this.upVector[2], 0.0]);    
    var upNewVec4 = m.multiplyVector4(upVec4);
    this.upVector = [upNewVec4.elements[0], upNewVec4.elements[1], upNewVec4.elements[2]];
       
    this.setCamera();    
  };
  
  //------------------------------------------------------------------------------
  // Reset the camera values to their default values/view
  this.resetCamera = function() {
    this.eye = this.eyeDefault.slice(0);
    this.at = this.atDefault.slice(0);
    this.upVector = this.upVectorDefault.slice(0);
    this.BoomAngle = 0;
    this.calculateBoomBase();

    this.setCamera();    
  };
  
  //------------------------------------------------------------------------------
  // Set the camera's transformation matrix based on the eye, at, and upVector.
  this.setCamera = function() {
    this.viewMatrix.setLookAt(this.eye[0],      this.eye[1],      this.eye[2], 
                              this.at[0],       this.at[1],       this.at[2],
                              this.upVector[0], this.upVector[1], this.upVector[2]);
  };

  //------------------------------------------------------------------------------
  this.printCamera = function() {
    console.log("u = " + this.u[0].toFixed(4) + " " + this.u[1].toFixed(4) + " " + this.u[2].toFixed(4));
    console.log("v = " + this.v[0].toFixed(4) + " " + this.v[1].toFixed(4) + " " + this.v[2].toFixed(4));
    console.log("n = " + this.n[0].toFixed(4) + " " + this.n[1].toFixed(4) + " " + this.n[2].toFixed(4));
  };
  
  //------------------------------------------------------------------------------
  this.calculateCameraCoordinateSystem = function() {
    this.n[0] = this.eye[0] - this.at[0];
    this.n[1] = this.eye[1] - this.at[1];
    this.n[2] = this.eye[2] - this.at[2];
    this.normalize(this.n);
    
    this.crossProduct(this.upVector, this.n, this.u);
    this.normalize(this.u);

    this.crossProduct(this.n, this.u, this.v);    
    this.normalize(this.v);
    
    //this.printCamera();
  };

  //------------------------------------------------------------------------------
  // Calculate the cross product of s and t to produce result
  this.crossProduct = function(s, t, result) {
    result[0] = s[1] * t[2] - s[2] * t[1];
    result[1] = s[2] * t[0] - s[0] * t[2];
    result[2] = s[0] * t[1] - s[1] * t[0];
  };

  //------------------------------------------------------------------------------
  // Normalize a vector to unit length
  this.normalize = function(v) {
    // Calculate length
    var length = Math.sqrt( v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
    
    if (length > 0) {
      v[0] /= length;
      v[1] /= length;
      v[2] /= length;
    }
  };
  
  //------------------------------------------------------------------------------
  // Calculate distance between two points
  this.distance = function(pt1, pt2) {
    var dx = pt1[0] - pt2[0]; 
    var dy = pt1[1] - pt2[1]; 
    var dz = pt1[2] - pt2[2]; 
    
    return Math.sqrt( dx*dx + dy*dy + dz*dz );
  };
  
  //------------------------------------------------------------------------------
  // Scale the vector v by the amount specified
  this.scale = function(vec, amount) {
    vec[0] *= amount; 
    vec[1] *= amount; 
    vec[2] *= amount; 
  };

  //------------------------------------------------------------------------------
  // Given a point, add a vector to get to a new point 
  this.add = function(pt, vec, newPt) {
    newPt[0] = pt[0] + vec[0]; 
    newPt[1] = pt[1] + vec[1]; 
    newPt[2] = pt[2] + vec[2]; 
  };

}

