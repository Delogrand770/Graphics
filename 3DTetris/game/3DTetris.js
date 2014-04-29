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

    switch (myGame.cameraMode) {
      case myGame.PAN_CAMERA:      myGame.panCamera(deltaX, deltaY);      break;
      case myGame.TILT_CAMERA:     myGame.tiltCamera(deltaX, deltaY);     break;
      case myGame.PEDESTAL_CAMERA: myGame.pedestalCamera(deltaX, deltaY); break;
      case myGame.TONGUE_CAMERA:   myGame.tougeCamera(deltaX, deltaY);    break;
      case myGame.CRANE_CAMERA:    myGame.craneCamera(deltaX, deltaY);    break;
      case myGame.DOLLY_CAMERA:    myGame.dollyCamera(deltaX, deltaY);    break;
      case myGame.TRUNK_CAMERA:    myGame.trunkCamera(deltaX, deltaY);    break;
      case myGame.ARC_CAMERA :     myGame.arcCamera(deltaX, deltaY);      break;
      case myGame.CANT_CAMERA :    myGame.cantCamera(deltaX, deltaY);     break;
    }

    myGame.draw();
    
    myGame.startOfMouseDrag = e;
  }
}

//------------------------------------------------------------------------------
var Tetris3D = function() {
  
  // Environment variables
  this.canvas = null;
  this.canvasNext = null;
  this.gl = null;
  this.glNext = null;
  this.program = null;
  
  // Graphic 3D models to render
  this.myWidgets = []; // only uses subscripts 1-4.
  this.myWidgetsNext = []; // only uses subscripts 1-4.
  this.myWidgetsCenters = [];
  this.myAxes = null;
  this.Container = null;
  
  // Container limits. Assumes the container is centered at the origin on 
  // x and z, and totally above the origin.
  this.MAX_X = 3.5;
  this.MAX_Z = 3.5;
  this.MAX_Y = 6;
  
  // Transformations for rendering the models. We keep the transformations
  // separate, but combine them into a single transform before we render
  // to make the rendering as fast as possible.
  this.projectionMatrix = new Matrix4();
  this.viewMatrix       = new Matrix4();
  this.viewMatrixNext   = new Matrix4();
  this.modelMatrix      = new Matrix4();
  // The combination of the projection, camera view, and model transforms
  this.combinedMatrix   = new Matrix4();
  this.combinedMatrixNext = new Matrix4();
  // Calculate the inverse of the modelMatrix to get the direction
  // of the global axes.
  this.modelMatrixInverse = new Matrix4();
  
  // Keep track of the last time the canvas was redrawn.
  this.previousTime = Date.now();
  
  // Initial location of the widget when it starts falling.
  this.activeWidget;
  this.nextWidget;
  this.widgetInitialLocation = [0, 14.5, 0];
  this.widgetCurrentLocation = this.widgetInitialLocation.slice(0);
  
  // An array of rotations -- the order matters.
  this.allRotations = [];
  
  // Is the game active or paused?
  this.gameActive;
  this.gameOver;
  
  // A container to hold the widgets that have finished falling.
  this.container;

  // Projection modes
  this.ORTHOGRAPHIC_PROJECTION = 0;
  this.PERSPECTIVE_PROJECTION  = 1;
  this.projectionMode = this.PERSPECTIVE_PROJECTION;
  
  // Camera Modes
  this.NO_CAMERA_MOVEMENT = 0;
  this.PAN_CAMERA         = 1;
  this.TILT_CAMERA        = 2;
  this.PEDESTAL_CAMERA    = 3;
  this.TONGUE_CAMERA      = 4;
  this.CRANE_CAMERA       = 5;
  this.DOLLY_CAMERA       = 6;
  this.TRUNK_CAMERA       = 7;
  this.ARC_CAMERA         = 8;
  this.CANT_CAMERA        = 9;
  this.RESET_CAMERA      = 10;
  
  // Camera Values
  this.cameraMode = this.NO_CAMERA_MOVEMENT;
  this.startOfMouseDrag = null;
  this.eye = [25.0, 20.0, 22.0];
  this.at = [0.0, 5.0, 0.0];
  this.upVector = [0.0, 1.0, 0.0];
  this.eyeDefault = this.eye.slice(0);
  this.atDefault = this.at.slice(0);
  this.upVectorDefault = this.upVector.slice(0);
  
  // Camera coordinate system
  this.u = [];
  this.v = [];
  this.n = [];
  
  // Camera manipulation increments
  this.ROTATE_ANGLE = 0.1;  // in degrees
  this.OFFSET_CAMERA = 0.1;
  this.BOOM_LENGTH = 20.0;
  this.boomAngle = 0.0;
  this.boomBase = [0,0,0];

  // Scoring
  this.score = 0;
  this.msg = 0;

  //------------------------------------------------------------------------------
  this.init = function(ng) {
  	if (!ng){
	    //Create styled containers
	    var game_window = XM.static({title: "Tetris", bodySource: "game_HTML", left: "center", top:5});
	    var info_window = XM.static({title: "Info", bodySource: "info_HTML", left: 50, top: 200});
	    var help_window = XM.static({title: "Help", bodySource: "help_HTML", left: 50, width: 200, top: 5, width: 225});
	    var ctrl_window = XM.static({title: "Controls", bodySource: "translation_HTML", width: 225, top: "center"});

	    //Position something based on distance from right side of screen
	    XU.DFR("xm_window" + ctrl_window, 50);
  	}

    document.getElementById('span_score').innerHTML = myGame.score;

    // Retrieve <canvas> element
    this.canvas = document.getElementById('GameWindow');
    this.canvasNext = document.getElementById('NextPiece');


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

    // Get the rendering context for WebGL
    this.glNext = getWebGLContext(this.canvasNext, true);
    if (!this.glNext) {
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

    if (!initShaders(this.glNext, vertexShaderText, fragmentShaderText)) {
      console.log('Fatal error: Failed to intialize shaders.');
      return;
    }


    // Set the clear color and enable the depth test
    this.gl.clearColor(0.7, 0.7, 0.7, 1.0);
    this.gl.enable(this.gl.DEPTH_TEST);

    this.glNext.clearColor(0.7, 0.7, 0.7, 1.0);
    this.glNext.enable(this.gl.DEPTH_TEST);

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

    var programNext = this.glNext.program;
    programNext.a_Position = this.glNext.getAttribLocation(programNext, 'a_Position');
    programNext.a_Color = this.glNext.getAttribLocation(programNext, 'a_Color');
    programNext.a_TexCoord = this.glNext.getAttribLocation(programNext, 'a_TexCoord');
    programNext.a_Normal = this.glNext.getAttribLocation(programNext, 'a_Normal');

    programNext.colorMode = this.glNext.getUniformLocation(programNext, 'colorMode');
    programNext.u_TransformMatrix = this.glNext.getUniformLocation(programNext, 'u_TransformMatrix');
    programNext.u_Sampler = this.glNext.getUniformLocation(programNext, 'u_Sampler');
    programNext.u_ModelMatrix = this.glNext.getUniformLocation(programNext, 'u_ModelMatrix');
    programNext.u_LightColor = this.glNext.getUniformLocation(programNext, 'u_LightColor');
    programNext.u_LightPosition = this.glNext.getUniformLocation(programNext, 'u_LightPosition');
    programNext.u_AmbientLight = this.glNext.getUniformLocation(programNext, 'u_AmbientLight');

    if (programNext.a_Position < 0     ||
        programNext.a_Normal < 0       ||
        programNext.a_TexCoord < 0     ||
        programNext.a_Color < 0        ||
        !programNext.colorMode         ||
        !programNext.u_TransformMatrix ||
        !programNext.u_ModelMatrix     ||
        !programNext.u_Sampler         ||
        !programNext.u_LightColor      ||
        !programNext.u_LightPosition   ||
        !programNext.u_AmbientLight) {
      console.log('Fatal error: failed to get the shader variable locations.');
      return;
    }

    var lightColor = new Float32Array([1.0, 1.0, 1.0]);
    this.lightPosition = new Float32Array([50.0, 40.0, 50.0]);
    var ambientLight = new Float32Array([0.7, 0.7, 0.7]);

    this.gl.uniform3fv(program.u_LightColor, lightColor);
    this.gl.uniform3fv(program.u_LightPosition, this.lightPosition);
    this.gl.uniform3fv(program.u_AmbientLight, ambientLight);

    this.glNext.uniform3fv(programNext.u_LightColor, lightColor);
    this.glNext.uniform3fv(programNext.u_LightPosition, this.lightPosition);
    this.glNext.uniform3fv(programNext.u_AmbientLight, ambientLight);

    // Create the 3D models from .obj data. The parameter must be a string that contains the OBJ data.
    this.Container = createModels3D(this.gl, program, 'Container3', 1, true);
    this.myAxes = createModels3D(this.gl, program, 'Axes', 0.9, true);

    this.myWidgets[1] = createModels3D(this.gl, program, 'square', 1, true);
    this.myWidgets[2] = createModels3D(this.gl, program, 'corner', 1, true);
    this.myWidgets[3] = createModels3D(this.gl, program, 'LShape', 1, true);
    this.myWidgets[4] = createModels3D(this.gl, program, 'TShape', 1, true);    
    this.myWidgets[5] = createModels3D(this.gl, program, 'line', 1, true);
    if (!this.myAxes || !this.Container || !this.myWidgets[1] || !this.myWidgets[2] 
        || !this.myWidgets[3] || !this.myWidgets[4] || !this.myWidgets[5]) {
      console.log("Fatal error: Could not create the models.");
      return;
    }

    this.myWidgetsNext[1] = createModels3D(this.glNext, programNext, 'square', 1, true);
    this.myWidgetsNext[2] = createModels3D(this.glNext, programNext, 'corner', 1, true);
    this.myWidgetsNext[3] = createModels3D(this.glNext, programNext, 'LShape', 1, true);
    this.myWidgetsNext[4] = createModels3D(this.glNext, programNext, 'TShape', 1, true);    
    this.myWidgetsNext[5] = createModels3D(this.glNext, programNext, 'line', 1, true);

    //Get model centers
    for (var j = 1; j < this.myWidgets.length; j++) {
      var data = [];
      for (var i = 0; i < this.myWidgets[j].length; i++){
        data.push(this.myWidgets[j][i].getCenterPoint());
      }
      this.myWidgetsCenters[j] = data;
    }

    // Create a projection from 3D space to a 2D screen.
    this.setProjection();

    // Create a view of the world. This transform positions the camera.
    this.viewMatrix.setIdentity();
    this.viewMatrix.lookAt(25.0, 20.0, 22.0, 0.0, 5.0, 0.0, 0.0, 1.0, 0.0);


    this.viewMatrixNext.setIdentity();
    this.viewMatrixNext.lookAt(0.0, -10.0, -10.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0);

    // Initialize the model transformation matrix to place the widget at its initial location.
    this.modelMatrix.setIdentity();
    this.modelMatrix.translate(this.widgetInitialLocation[0], 
                               this.widgetInitialLocation[1], 
                               this.widgetInitialLocation[2]);
    
    this.container = new TetrisContainer();
    this.container.create(7,14,7,3,-0.5,3);
    
    this.activeWidget = Math.floor(Math.random() * 4) + 1;
    this.gameActive = true;
    this.gameOver = false;


    myGame.nextWidget = Math.floor(Math.random() * 5) + 1;
    this.tick();
  };
  
  //------------------------------------------------------------------------------
  // Animation function, which drops the widget 1 unit on the y axis each second.
  this.tick = function() {

    var now = Date.now();
    var elapsedTime = now - myGame.previousTime;
    
    if (elapsedTime >= 1000) {
      if (! myGame.translate(0,-1,0)) {
        // Add the current widget to the container.
        var addSuccessful = 
          myGame.container.addWidget(myGame.myWidgets[myGame.activeWidget], 
                                     myGame.myWidgetsCenters[myGame.activeWidget], 
                                     myGame.modelMatrix);

        myGame.score += 10;
        document.getElementById('span_score').innerHTML = myGame.score;
        if (!addSuccessful) {
        	if (myGame.msg == 0){
          	myGame.msg = XM.alert({title:"3D Tetris", body: "Game Over", callback: function(){myGame.reset()}});
        	}
          this.gameActive = false;
          this.gameOver = true;
        }
        
        // Remove any levels in the container that are full.
        myGame.container.removeFullLevels();
                                   
        // Start a new widget at the top of the container.
        myGame.activeWidget = myGame.nextWidget;
        myGame.nextWidget = Math.floor(Math.random() * 5) + 1;
        myGame.widgetCurrentLocation = myGame.widgetInitialLocation.slice(0);
        myGame.allRotations = [];
        myGame.buildModelMatrix();
      }
      myGame.previousTime = now;
    }
    
    if (myGame.gameActive) {
      // Request that the browser call tick
      requestAnimationFrame(myGame.tick); 
    }
  };

  this.reset = function() {
  	myGame = new Tetris3D();
  	myGame.init(1);
  }
  
  //------------------------------------------------------------------------------
  this.draw = function() {

    var j;
    var program = this.gl.program;
    var programNext = this.glNext.program;
    
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    // Step 1: clear the graphics window -- and depth buffers
    this.gl.clearColor(0.8, 0.8, 0.8, 1.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

    this.glNext.clearColor(0.0, 0.0, 0.0, 1.0);
    this.glNext.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    // Step 2: Draw the objects that don't move. This includes the open  
    // container and the global axes. The only transformation is for the 
    // camera and projection.
    this.combinedMatrix.setIdentity();
    this.combinedMatrix.multiply(this.projectionMatrix);
    this.combinedMatrix.multiply(this.viewMatrix);

    this.combinedMatrixNext.setIdentity();
    this.combinedMatrixNext.multiply(this.projectionMatrix);
    this.combinedMatrixNext.multiply(this.viewMatrixNext);
    
    this.gl.uniformMatrix4fv(program.u_TransformMatrix, false, this.combinedMatrix.elements);
    this.glNext.uniformMatrix4fv(programNext.u_TransformMatrix, false, this.combinedMatrixNext.elements);

    for (j=0; j<this.myAxes.length; j++) {
      this.myAxes[j].draw(this.gl, program);
    }
    for (j=0; j<this.Container.length; j++) {
      this.Container[j].draw(this.gl, program);
    }
    this.container.draw(this.combinedMatrix, this.gl, program);

    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    // Step 3: Now draw the objects that move. This requires appending the 
    // transformations we want to apply to the model onto the camera and projection
    // transforms.    
    this.combinedMatrix.multiply(this.modelMatrix);
    
    this.gl.uniformMatrix4fv(program.u_TransformMatrix, false, this.combinedMatrix.elements);

    // Draw widget
    var widget = this.myWidgets[this.activeWidget];
    var widgetNext = this.myWidgetsNext[this.nextWidget];
    for (j=0; j<widget.length; j++) {
      widget[j].draw(this.gl, program);
    }
    for (j=0; j<widgetNext.length; j++) {
      widgetNext[j].draw(this.glNext, programNext);
    }
  };

  //------------------------------------------------------------------------------
  this.translateMinusX = function() {
    this.translate(-1,0,0);
  };

  //------------------------------------------------------------------------------
  this.translatePlusX = function() {
    this.translate(1,0,0);
  };

  //------------------------------------------------------------------------------
  this.translateMinusZ = function() {
    this.translate(0,0,-1);
  };

  //------------------------------------------------------------------------------
  this.translatePlusZ = function() {
    this.translate(0,0,1);
  };

  //------------------------------------------------------------------------------
  this.rotatePlusZ = function() {
    this.rotate(90, 0, 0, 1);
  };

  //------------------------------------------------------------------------------
  this.rotateMinusZ = function() {
    this.rotate(-90, 0, 0, 1);
  };

  //------------------------------------------------------------------------------
  this.rotatePlusX = function() {
    this.rotate(90, 1, 0, 0);
  };

  //------------------------------------------------------------------------------
  this.rotateMinusX = function() {
    this.rotate(-90, 1, 0, 0);
  };

  //------------------------------------------------------------------------------
  this.rotatePlusY = function() {
    this.rotate(90, 0, 1, 0);
  };

  //------------------------------------------------------------------------------
  this.rotateMinusY = function() {
    this.rotate(-90, 0, 1, 0);
  };

  //------------------------------------------------------------------------------
  this.drop = function() {
    // Decrease the y value of the widget until it can't be decreased any more.
    // You can't just set the y value to 0.5 because you don't know the widget's
    // orientation.
    while (this.translate(0,-1,0)) {
      ;
    }
    
    // Change the animation's previousTime value so that the widget sits at the 
    // bottom of the container for 1 second before a new widget starts.
    this.previousTime = Date.now();
  };

  //------------------------------------------------------------------------------
  this.pauseGame = function() {
    // Change the status of play.
    this.gameActive = ! this.gameActive;
    
    // Get the button so the title of the button can be changed.
    var button = document.getElementById('pause');
    
    if (this.gameActive) {
      button.innerHTML = 'Pause';
      // restart the animation
      this.tick();
    } else {
      button.innerHTML = 'Resume';
    } 
  };

  //------------------------------------------------------------------------------
  this.startOver = function() {
    alert("start game over");
  };

  //------------------------------------------------------------------------------
  this.myKeyEvent = function(event) {

    alert(event.keyCode);
  };

  //------------------------------------------------------------------------------
  this.buildModelMatrix = function() {
    var j, rot;
    
    this.modelMatrix.setIdentity();
    
    // translate to the correct location
    this.modelMatrix.translate(this.widgetCurrentLocation[0], 
                               this.widgetCurrentLocation[1], 
                               this.widgetCurrentLocation[2]);

    // perform all the rotations in the order they happened.
    for (j=this.allRotations.length-1; j>= 0; j--) {
      rot = this.allRotations[j];
      this.modelMatrix.rotate(rot[0], rot[1], rot[2], rot[3]);
    }    

  }
  
  //------------------------------------------------------------------------------
  this.rotate = function(angle, ax, ay, az) {
    //console.log("rotate angle = " + angle + "  vector = " + ax + "  " + ay + "  " + az);
    
    if (! this.gameActive) return;
    
    // Save the current rotation.
    this.allRotations.push( [angle, ax, ay, az] );
    
    // Rebuild the modelMatix to include the current rotation.
    this.buildModelMatrix();
    
    var valid = this.container.widgetLocationIsValid(
               this.myWidgetsCenters[this.activeWidget], this.modelMatrix);                            
    if (! valid) {
      // Undo the rotate
      this.allRotations.pop();
      this.buildModelMatrix();
    } else {
      // the rotation was valid, so redraw
      this.draw(); 
    }
  };
  
  //------------------------------------------------------------------------------
  this.translate = function(dx, dy, dz) {
    var translateWasValid = false;
    //console.log("translate dx = " + dx + "  dy = " + dy + "  dz = " + dz);
    
    if (! this.gameActive) return translateWasValid;

    this.widgetCurrentLocation[0] += dx;
    this.widgetCurrentLocation[1] += dy;
    this.widgetCurrentLocation[2] += dz;
        
    this.buildModelMatrix();
         
    var translateWasValid = this.container.widgetLocationIsValid(
               this.myWidgetsCenters[this.activeWidget], this.modelMatrix);                            
    
    if (translateWasValid) {
      // The translate is valid, so redraw.
      this.draw();
    } else {
      // The translate was invalid, so undo the translate
      this.widgetCurrentLocation[0] -= dx;
      this.widgetCurrentLocation[1] -= dy;
      this.widgetCurrentLocation[2] -= dz;
      this.buildModelMatrix();
    }
    
    return translateWasValid;
  };
  
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
        var left = -6.0;
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
    if (mode == this.RESET_CAMERA) {
      this.resetCamera();
      this.draw();
    }
    if (mode == this.CRANE_CAMERA || mode == this.TONGUE_CAMERA) {
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

