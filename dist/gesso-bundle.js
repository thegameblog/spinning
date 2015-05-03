(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var Gesso = require('gesso');
var fillRotatedRect = require('./helpers').fillRotatedRect;

// Create the game object
var game = new Gesso();

// We'll use closures for game variables
var seconds = 0;

// This gets called every frame. Update your game state here.
game.update(function () {
  // Calculate the time passed, based on 60 frames per second
  seconds += 1 / 60;
});

// This gets called at least once per frame. You can call
// Gesso.renderTo(target) to render the game to another canvas.
game.render(function (ctx) {
  // Calculate one rotation per second
  var angle = seconds * (Math.PI / 2);

  // Clear the canvas
  ctx.clearRect(0, 0, game.width, game.height);

  // Draw a red box, rotating four times per second
  ctx.fillStyle = '#f34';
  fillRotatedRect(ctx, 50, 100, 200, 20, angle * 4);

  // Draw a green box, fully rotating every two seconds
  ctx.fillStyle = '#cf8';
  fillRotatedRect(ctx, 400, 50, 200, 150, -angle / 2);

  // Draw a blue box, fully rotating two times per second
  ctx.fillStyle = '#3cf';
  fillRotatedRect(ctx, 200, 250, 200, 200, angle * 2);
});

// Run the game
game.run();

},{"./helpers":2,"gesso":10}],2:[function(require,module,exports){
// Draws a rectangle rotated at the specified angle (in radians)
function fillRotatedRect(ctx, x, y, width, height, angle) {
  // Get the origin of the rectangle around its center
  var originX = width / 2;
  var originY = height / 2;

  // Save the unrotated context of the canvas so we can restore it later
  ctx.save();

  // Rotate the around the origin, given the specified offset
  ctx.translate(x + originX, y + originY);
  ctx.rotate(angle);

  // After transforming, (0,0) is visually (-originX,-originY), so the box
  // needs to be offset accordingly
  ctx.fillRect(-originX, -originY, width, height);

   // We're done with the rotating, so restore to the unrotated context
  ctx.restore();
}


module.exports = {
  fillRotatedRect: fillRotatedRect
};

},{}],3:[function(require,module,exports){
var lowLevel = require('./lowLevel');


function Controller(gesso, canvas) {
  this.gesso = gesso;
  this._canvas = canvas || lowLevel.getCanvas();
  this._context = this._canvas.getContext('2d');
  this._running = null;
  this._requestId = null;
}
Controller.prototype.stepOnce = function (timestamp) {
  this.gesso.step(this._context);
};
Controller.prototype.continueOn = function (timestamp) {
  this.stepOnce();

  var self = this;
  self._requestId = lowLevel.requestAnimationFrame(function (timestamp) {
    self._requestId = null;
    if (!self._running) {
      return;
    }
    // TODO: FPS
    self.continueOn();
  });
};
Controller.prototype.start = function start() {
  if (this._running) {
    return;
  }
  this._running = true;

  this.gesso.initialize();
  this.gesso.start.invoke();
  // TODO: Use a scheduler
  this.continueOn();
};
Controller.prototype.stop = function stop() {
  if (!this._running) {
    return;
  }
  this._running = false;

  lowLevel.cancelAnimationFrame(this._requestId);
  this._requestId = null;
  this.gesso.stop.invoke();
};


module.exports = Controller;

},{"./lowLevel":8}],4:[function(require,module,exports){
var util = require('./util');


// Returns a callable object that, when called with a function, subscribes
// to the delegate. Call invoke on this object to invoke each handler.
function Delegate() {
  var handlers = [];

  function callable(handler) {
    if (arguments.length !== 1) {
      throw new Error('Delegate takes exactly 1 argument (' + arguments.length + ' given)');
    } else if (typeof handler !== 'function') {
      throw new Error('Delegate argument must be a Function object (got ' + typeof handler + ')');
    }
    handlers.push(handler);
    return function unsubscribe() {
      return util.removeLast(handlers, handler);
    };
  }
  callable.invoke = function invoke() {
    var args = arguments;
    util.forEach(handlers, function (handler) {
      handler.apply(null, args);
    });
  };
  // Expose handlers for inspection
  callable.handlers = handlers;

  return callable;
}


module.exports = Delegate;

},{"./util":9}],5:[function(require,module,exports){
var Controller = require('./controller');
var Delegate = require('./delegate');
var lowLevel = require('./lowLevel');
var logging = require('./logging');


function Gesso(options) {
  options = options || {};
  this.contextType = options.contextType || '2d';
  this.contextAttributes = options.contextAttributes;
  this.fps = options.fps || 60;
  this.autoplay = options.autoplay || true;
  this.setup = new Delegate();
  this.start = new Delegate();
  this.stop = new Delegate();
  this.update = new Delegate();
  this.render = new Delegate();
  this.width = options.width || 640;    // TODO: allow 'null' to use width of target canvas
  this.height = options.height || 640;  // TODO: allow 'null' to use height of target canvas
  this._initialized = false;
}
Gesso.Controller = Controller;
Gesso.Delegate = Delegate;
Gesso.requestAnimationFrame = lowLevel.requestAnimationFrame;
Gesso.cancelAnimationFrame = lowLevel.cancelAnimationFrame;
Gesso.getCanvas = lowLevel.getCanvas;
Gesso.getContext2D = lowLevel.getContext2D;
Gesso.getWebGLContext = lowLevel.getWebGLContext;
Gesso.error = logging.error;
Gesso.info = logging.info;
Gesso.log = logging.log;
Gesso.warn = logging.warn;
Gesso.prototype.initialize = function initialize() {
  if (this._initialized) {
    return;
  }
  this._initialized = true;
  this.setup.invoke();
};
Gesso.prototype.step = function step(context) {
  this.nextFrame();
  this.renderTo(context);
};
Gesso.prototype.nextFrame = function nextFrame() {
  return this.update.invoke();
};
Gesso.prototype.renderTo = function renderTo(context) {
  return this.render.invoke(context);
};
Gesso.prototype.run = function run(canvas) {
  var controller = new Controller(this, canvas);
  controller.start();
  return controller;
};


module.exports = Gesso;

},{"./controller":3,"./delegate":4,"./logging":7,"./lowLevel":8}],6:[function(require,module,exports){
var Gesso = require('./gesso');

// TODO: Delete this
window.Gesso = Gesso;

module.exports = Gesso;

},{"./gesso":5}],7:[function(require,module,exports){
/* globals $ */


// TODO: Logger class
// TODO: Pluggable log backend, e.g. console.log


function _send(level, args) {
  // TODO: Inspect object instead of sending [object Object]
  // TODO: Remove the implied jQuery dependency
  $.post('/log', {
    level: level,
    message: args.join(' ')
  }).fail(function(xhr, textStatus, errorThrown) {
    // TODO: Notify user on the page and show message if console.log doesn't exist
    if (console && console.log) {
      console.log(xhr.responseText);
    }
  });
}


function error(message) {
  return _send('error', Array.prototype.slice.call(arguments));
}


function info(message) {
  return _send('info', Array.prototype.slice.call(arguments));
}


function log(message) {
  return _send('log', Array.prototype.slice.call(arguments));
}


function warn(message) {
  return _send('warn', Array.prototype.slice.call(arguments));
}


module.exports = {
  error: error,
  info: info,
  log: log,
  warn: warn
};

},{}],8:[function(require,module,exports){
var raf = (function () {
  // Raf polyfill by Erik Möller. fixes from Paul Irish and Tino Zijdel
  // Adapted by Joe Esposito
  // Origin: http://paulirish.com/2011/requestanimationframe-for-smart-animating/
  //         http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating
  // MIT license

  var requestAnimationFrame = typeof window !== 'undefined' ? window.requestAnimationFrame : null;
  var cancelAnimationFrame = typeof window !== 'undefined' ? window.cancelAnimationFrame : null;

  var vendors = ['ms', 'moz', 'webkit', 'o'];
  for(var x = 0; x < vendors.length && !requestAnimationFrame; ++x) {
    requestAnimationFrame = window[vendors[x] + 'RequestAnimationFrame'];
    cancelAnimationFrame = window[vendors[x] + 'CancelAnimationFrame'] || window[vendors[x] + 'CancelRequestAnimationFrame'];
  }

  if (!requestAnimationFrame) {
    var lastTime = 0;
    requestAnimationFrame = function(callback) {
      var currTime = new Date().getTime();
      var timeToCall = Math.max(0, 16 - (currTime - lastTime));
      var id = setTimeout(function() { callback(currTime + timeToCall); }, timeToCall);
      lastTime = currTime + timeToCall;
      return id;
    };

    cancelAnimationFrame = function(id) {
      clearTimeout(id);
    };
  }

  return {
    requestAnimationFrame: function(callback) { return requestAnimationFrame(callback); },
    cancelAnimationFrame: function(requestID) { return cancelAnimationFrame(requestID); }
  };
})();


function getCanvas() {
  // TODO: Extract this out to break dependency
  if (typeof window === 'undefined') {
    throw new Error('Cannot get canvas outside of browser context.');
  }

  // TODO: Read the project settings use the right ID
  var canvas = window.document.getElementById('gesso-target');

  if (!canvas) {
    var canvases = window.document.getElementsByTagName('canvas');
    if (canvases.length === 1) {
      canvas = canvases[0];
    }
  }

  if (!canvas) {
    throw new Error('Canvas not found.');
  }

  return canvas;
}


function getContext2D() {
  return getCanvas().getContext('2d');
}


function getWebGLContext() {
  return getCanvas().getContext('webgl');
}


module.exports = {
  requestAnimationFrame: raf.requestAnimationFrame,
  cancelAnimationFrame: raf.cancelAnimationFrame,
  getCanvas: getCanvas,
  getContext2D: getContext2D,
  getWebGLContext: getWebGLContext
};

},{}],9:[function(require,module,exports){
function forEach(array, stepFunction) {
  for (var index = 0; index < array.length; index++) {
    stepFunction(array[index]);
  }
}


function pop(array, index) {
  return typeof index === 'undefined' ? array.pop() : array.splice(index, 1)[0];
}


function indexOf(array, item, startIndex) {
  for (var index = startIndex || 0; index < array.length; index++) {
    if (array[index] === item) {
      return index;
    }
  }
  return -1;
}


function lastIndexOf(array, item, startIndex) {
  for (var index = startIndex || array.length - 1; index >= 0; index--) {
    if (array[index] === item) {
      return index;
    }
  }
  return -1;
}


function remove(array, item) {
  var index = indexOf(array, item);
  return index !== -1 ? pop(array, index) : null;
}


function removeLast(array, item) {
  var index = lastIndexOf(array, item);
  return index !== -1 ? pop(array, index) : null;
}


module.exports = {
  forEach: forEach,
  pop: pop,
  indexOf: indexOf,
  lastIndexOf: lastIndexOf,
  remove: remove,
  removeLast: removeLast
};

},{}],10:[function(require,module,exports){
// Gesso Entry Point
// Detect whether this is called from the browser, or from the CLI.


if (typeof window === 'undefined') {
  // Use module.require so the client-side build skips over server code,
  // which will work properly at runtime since no window global is defined
  module.exports = module.require('./gesso');
} else {
  // Include in client-side build,
  // which will have a window global defined at runtime
  module.exports = require('./client');
}

},{"./client":6}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9nZXNzby9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiaW5kZXguanMiLCJoZWxwZXJzLmpzIiwibm9kZV9tb2R1bGVzL2dlc3NvL2NsaWVudC9jb250cm9sbGVyLmpzIiwibm9kZV9tb2R1bGVzL2dlc3NvL2NsaWVudC9kZWxlZ2F0ZS5qcyIsIm5vZGVfbW9kdWxlcy9nZXNzby9jbGllbnQvZ2Vzc28uanMiLCJub2RlX21vZHVsZXMvZ2Vzc28vY2xpZW50L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2dlc3NvL2NsaWVudC9sb2dnaW5nLmpzIiwibm9kZV9tb2R1bGVzL2dlc3NvL2NsaWVudC9sb3dMZXZlbC5qcyIsIm5vZGVfbW9kdWxlcy9nZXNzby9jbGllbnQvdXRpbC5qcyIsIm5vZGVfbW9kdWxlcy9nZXNzby9pbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIEdlc3NvID0gcmVxdWlyZSgnZ2Vzc28nKTtcclxudmFyIGZpbGxSb3RhdGVkUmVjdCA9IHJlcXVpcmUoJy4vaGVscGVycycpLmZpbGxSb3RhdGVkUmVjdDtcclxuXHJcbi8vIENyZWF0ZSB0aGUgZ2FtZSBvYmplY3RcclxudmFyIGdhbWUgPSBuZXcgR2Vzc28oKTtcclxuXHJcbi8vIFdlJ2xsIHVzZSBjbG9zdXJlcyBmb3IgZ2FtZSB2YXJpYWJsZXNcclxudmFyIHNlY29uZHMgPSAwO1xyXG5cclxuLy8gVGhpcyBnZXRzIGNhbGxlZCBldmVyeSBmcmFtZS4gVXBkYXRlIHlvdXIgZ2FtZSBzdGF0ZSBoZXJlLlxyXG5nYW1lLnVwZGF0ZShmdW5jdGlvbiAoKSB7XHJcbiAgLy8gQ2FsY3VsYXRlIHRoZSB0aW1lIHBhc3NlZCwgYmFzZWQgb24gNjAgZnJhbWVzIHBlciBzZWNvbmRcclxuICBzZWNvbmRzICs9IDEgLyA2MDtcclxufSk7XHJcblxyXG4vLyBUaGlzIGdldHMgY2FsbGVkIGF0IGxlYXN0IG9uY2UgcGVyIGZyYW1lLiBZb3UgY2FuIGNhbGxcclxuLy8gR2Vzc28ucmVuZGVyVG8odGFyZ2V0KSB0byByZW5kZXIgdGhlIGdhbWUgdG8gYW5vdGhlciBjYW52YXMuXHJcbmdhbWUucmVuZGVyKGZ1bmN0aW9uIChjdHgpIHtcclxuICAvLyBDYWxjdWxhdGUgb25lIHJvdGF0aW9uIHBlciBzZWNvbmRcclxuICB2YXIgYW5nbGUgPSBzZWNvbmRzICogKE1hdGguUEkgLyAyKTtcclxuXHJcbiAgLy8gQ2xlYXIgdGhlIGNhbnZhc1xyXG4gIGN0eC5jbGVhclJlY3QoMCwgMCwgZ2FtZS53aWR0aCwgZ2FtZS5oZWlnaHQpO1xyXG5cclxuICAvLyBEcmF3IGEgcmVkIGJveCwgcm90YXRpbmcgZm91ciB0aW1lcyBwZXIgc2Vjb25kXHJcbiAgY3R4LmZpbGxTdHlsZSA9ICcjZjM0JztcclxuICBmaWxsUm90YXRlZFJlY3QoY3R4LCA1MCwgMTAwLCAyMDAsIDIwLCBhbmdsZSAqIDQpO1xyXG5cclxuICAvLyBEcmF3IGEgZ3JlZW4gYm94LCBmdWxseSByb3RhdGluZyBldmVyeSB0d28gc2Vjb25kc1xyXG4gIGN0eC5maWxsU3R5bGUgPSAnI2NmOCc7XHJcbiAgZmlsbFJvdGF0ZWRSZWN0KGN0eCwgNDAwLCA1MCwgMjAwLCAxNTAsIC1hbmdsZSAvIDIpO1xyXG5cclxuICAvLyBEcmF3IGEgYmx1ZSBib3gsIGZ1bGx5IHJvdGF0aW5nIHR3byB0aW1lcyBwZXIgc2Vjb25kXHJcbiAgY3R4LmZpbGxTdHlsZSA9ICcjM2NmJztcclxuICBmaWxsUm90YXRlZFJlY3QoY3R4LCAyMDAsIDI1MCwgMjAwLCAyMDAsIGFuZ2xlICogMik7XHJcbn0pO1xyXG5cclxuLy8gUnVuIHRoZSBnYW1lXHJcbmdhbWUucnVuKCk7XHJcbiIsIi8vIERyYXdzIGEgcmVjdGFuZ2xlIHJvdGF0ZWQgYXQgdGhlIHNwZWNpZmllZCBhbmdsZSAoaW4gcmFkaWFucylcclxuZnVuY3Rpb24gZmlsbFJvdGF0ZWRSZWN0KGN0eCwgeCwgeSwgd2lkdGgsIGhlaWdodCwgYW5nbGUpIHtcclxuICAvLyBHZXQgdGhlIG9yaWdpbiBvZiB0aGUgcmVjdGFuZ2xlIGFyb3VuZCBpdHMgY2VudGVyXHJcbiAgdmFyIG9yaWdpblggPSB3aWR0aCAvIDI7XHJcbiAgdmFyIG9yaWdpblkgPSBoZWlnaHQgLyAyO1xyXG5cclxuICAvLyBTYXZlIHRoZSB1bnJvdGF0ZWQgY29udGV4dCBvZiB0aGUgY2FudmFzIHNvIHdlIGNhbiByZXN0b3JlIGl0IGxhdGVyXHJcbiAgY3R4LnNhdmUoKTtcclxuXHJcbiAgLy8gUm90YXRlIHRoZSBhcm91bmQgdGhlIG9yaWdpbiwgZ2l2ZW4gdGhlIHNwZWNpZmllZCBvZmZzZXRcclxuICBjdHgudHJhbnNsYXRlKHggKyBvcmlnaW5YLCB5ICsgb3JpZ2luWSk7XHJcbiAgY3R4LnJvdGF0ZShhbmdsZSk7XHJcblxyXG4gIC8vIEFmdGVyIHRyYW5zZm9ybWluZywgKDAsMCkgaXMgdmlzdWFsbHkgKC1vcmlnaW5YLC1vcmlnaW5ZKSwgc28gdGhlIGJveFxyXG4gIC8vIG5lZWRzIHRvIGJlIG9mZnNldCBhY2NvcmRpbmdseVxyXG4gIGN0eC5maWxsUmVjdCgtb3JpZ2luWCwgLW9yaWdpblksIHdpZHRoLCBoZWlnaHQpO1xyXG5cclxuICAgLy8gV2UncmUgZG9uZSB3aXRoIHRoZSByb3RhdGluZywgc28gcmVzdG9yZSB0byB0aGUgdW5yb3RhdGVkIGNvbnRleHRcclxuICBjdHgucmVzdG9yZSgpO1xyXG59XHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgZmlsbFJvdGF0ZWRSZWN0OiBmaWxsUm90YXRlZFJlY3RcclxufTtcclxuIiwidmFyIGxvd0xldmVsID0gcmVxdWlyZSgnLi9sb3dMZXZlbCcpO1xuXG5cbmZ1bmN0aW9uIENvbnRyb2xsZXIoZ2Vzc28sIGNhbnZhcykge1xuICB0aGlzLmdlc3NvID0gZ2Vzc287XG4gIHRoaXMuX2NhbnZhcyA9IGNhbnZhcyB8fCBsb3dMZXZlbC5nZXRDYW52YXMoKTtcbiAgdGhpcy5fY29udGV4dCA9IHRoaXMuX2NhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuICB0aGlzLl9ydW5uaW5nID0gbnVsbDtcbiAgdGhpcy5fcmVxdWVzdElkID0gbnVsbDtcbn1cbkNvbnRyb2xsZXIucHJvdG90eXBlLnN0ZXBPbmNlID0gZnVuY3Rpb24gKHRpbWVzdGFtcCkge1xuICB0aGlzLmdlc3NvLnN0ZXAodGhpcy5fY29udGV4dCk7XG59O1xuQ29udHJvbGxlci5wcm90b3R5cGUuY29udGludWVPbiA9IGZ1bmN0aW9uICh0aW1lc3RhbXApIHtcbiAgdGhpcy5zdGVwT25jZSgpO1xuXG4gIHZhciBzZWxmID0gdGhpcztcbiAgc2VsZi5fcmVxdWVzdElkID0gbG93TGV2ZWwucmVxdWVzdEFuaW1hdGlvbkZyYW1lKGZ1bmN0aW9uICh0aW1lc3RhbXApIHtcbiAgICBzZWxmLl9yZXF1ZXN0SWQgPSBudWxsO1xuICAgIGlmICghc2VsZi5fcnVubmluZykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvLyBUT0RPOiBGUFNcbiAgICBzZWxmLmNvbnRpbnVlT24oKTtcbiAgfSk7XG59O1xuQ29udHJvbGxlci5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbiBzdGFydCgpIHtcbiAgaWYgKHRoaXMuX3J1bm5pbmcpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgdGhpcy5fcnVubmluZyA9IHRydWU7XG5cbiAgdGhpcy5nZXNzby5pbml0aWFsaXplKCk7XG4gIHRoaXMuZ2Vzc28uc3RhcnQuaW52b2tlKCk7XG4gIC8vIFRPRE86IFVzZSBhIHNjaGVkdWxlclxuICB0aGlzLmNvbnRpbnVlT24oKTtcbn07XG5Db250cm9sbGVyLnByb3RvdHlwZS5zdG9wID0gZnVuY3Rpb24gc3RvcCgpIHtcbiAgaWYgKCF0aGlzLl9ydW5uaW5nKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIHRoaXMuX3J1bm5pbmcgPSBmYWxzZTtcblxuICBsb3dMZXZlbC5jYW5jZWxBbmltYXRpb25GcmFtZSh0aGlzLl9yZXF1ZXN0SWQpO1xuICB0aGlzLl9yZXF1ZXN0SWQgPSBudWxsO1xuICB0aGlzLmdlc3NvLnN0b3AuaW52b2tlKCk7XG59O1xuXG5cbm1vZHVsZS5leHBvcnRzID0gQ29udHJvbGxlcjtcbiIsInZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyk7XG5cblxuLy8gUmV0dXJucyBhIGNhbGxhYmxlIG9iamVjdCB0aGF0LCB3aGVuIGNhbGxlZCB3aXRoIGEgZnVuY3Rpb24sIHN1YnNjcmliZXNcbi8vIHRvIHRoZSBkZWxlZ2F0ZS4gQ2FsbCBpbnZva2Ugb24gdGhpcyBvYmplY3QgdG8gaW52b2tlIGVhY2ggaGFuZGxlci5cbmZ1bmN0aW9uIERlbGVnYXRlKCkge1xuICB2YXIgaGFuZGxlcnMgPSBbXTtcblxuICBmdW5jdGlvbiBjYWxsYWJsZShoYW5kbGVyKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggIT09IDEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRGVsZWdhdGUgdGFrZXMgZXhhY3RseSAxIGFyZ3VtZW50ICgnICsgYXJndW1lbnRzLmxlbmd0aCArICcgZ2l2ZW4pJyk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgaGFuZGxlciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdEZWxlZ2F0ZSBhcmd1bWVudCBtdXN0IGJlIGEgRnVuY3Rpb24gb2JqZWN0IChnb3QgJyArIHR5cGVvZiBoYW5kbGVyICsgJyknKTtcbiAgICB9XG4gICAgaGFuZGxlcnMucHVzaChoYW5kbGVyKTtcbiAgICByZXR1cm4gZnVuY3Rpb24gdW5zdWJzY3JpYmUoKSB7XG4gICAgICByZXR1cm4gdXRpbC5yZW1vdmVMYXN0KGhhbmRsZXJzLCBoYW5kbGVyKTtcbiAgICB9O1xuICB9XG4gIGNhbGxhYmxlLmludm9rZSA9IGZ1bmN0aW9uIGludm9rZSgpIHtcbiAgICB2YXIgYXJncyA9IGFyZ3VtZW50cztcbiAgICB1dGlsLmZvckVhY2goaGFuZGxlcnMsIGZ1bmN0aW9uIChoYW5kbGVyKSB7XG4gICAgICBoYW5kbGVyLmFwcGx5KG51bGwsIGFyZ3MpO1xuICAgIH0pO1xuICB9O1xuICAvLyBFeHBvc2UgaGFuZGxlcnMgZm9yIGluc3BlY3Rpb25cbiAgY2FsbGFibGUuaGFuZGxlcnMgPSBoYW5kbGVycztcblxuICByZXR1cm4gY2FsbGFibGU7XG59XG5cblxubW9kdWxlLmV4cG9ydHMgPSBEZWxlZ2F0ZTtcbiIsInZhciBDb250cm9sbGVyID0gcmVxdWlyZSgnLi9jb250cm9sbGVyJyk7XG52YXIgRGVsZWdhdGUgPSByZXF1aXJlKCcuL2RlbGVnYXRlJyk7XG52YXIgbG93TGV2ZWwgPSByZXF1aXJlKCcuL2xvd0xldmVsJyk7XG52YXIgbG9nZ2luZyA9IHJlcXVpcmUoJy4vbG9nZ2luZycpO1xuXG5cbmZ1bmN0aW9uIEdlc3NvKG9wdGlvbnMpIHtcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gIHRoaXMuY29udGV4dFR5cGUgPSBvcHRpb25zLmNvbnRleHRUeXBlIHx8ICcyZCc7XG4gIHRoaXMuY29udGV4dEF0dHJpYnV0ZXMgPSBvcHRpb25zLmNvbnRleHRBdHRyaWJ1dGVzO1xuICB0aGlzLmZwcyA9IG9wdGlvbnMuZnBzIHx8IDYwO1xuICB0aGlzLmF1dG9wbGF5ID0gb3B0aW9ucy5hdXRvcGxheSB8fCB0cnVlO1xuICB0aGlzLnNldHVwID0gbmV3IERlbGVnYXRlKCk7XG4gIHRoaXMuc3RhcnQgPSBuZXcgRGVsZWdhdGUoKTtcbiAgdGhpcy5zdG9wID0gbmV3IERlbGVnYXRlKCk7XG4gIHRoaXMudXBkYXRlID0gbmV3IERlbGVnYXRlKCk7XG4gIHRoaXMucmVuZGVyID0gbmV3IERlbGVnYXRlKCk7XG4gIHRoaXMud2lkdGggPSBvcHRpb25zLndpZHRoIHx8IDY0MDsgICAgLy8gVE9ETzogYWxsb3cgJ251bGwnIHRvIHVzZSB3aWR0aCBvZiB0YXJnZXQgY2FudmFzXG4gIHRoaXMuaGVpZ2h0ID0gb3B0aW9ucy5oZWlnaHQgfHwgNjQwOyAgLy8gVE9ETzogYWxsb3cgJ251bGwnIHRvIHVzZSBoZWlnaHQgb2YgdGFyZ2V0IGNhbnZhc1xuICB0aGlzLl9pbml0aWFsaXplZCA9IGZhbHNlO1xufVxuR2Vzc28uQ29udHJvbGxlciA9IENvbnRyb2xsZXI7XG5HZXNzby5EZWxlZ2F0ZSA9IERlbGVnYXRlO1xuR2Vzc28ucmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gbG93TGV2ZWwucmVxdWVzdEFuaW1hdGlvbkZyYW1lO1xuR2Vzc28uY2FuY2VsQW5pbWF0aW9uRnJhbWUgPSBsb3dMZXZlbC5jYW5jZWxBbmltYXRpb25GcmFtZTtcbkdlc3NvLmdldENhbnZhcyA9IGxvd0xldmVsLmdldENhbnZhcztcbkdlc3NvLmdldENvbnRleHQyRCA9IGxvd0xldmVsLmdldENvbnRleHQyRDtcbkdlc3NvLmdldFdlYkdMQ29udGV4dCA9IGxvd0xldmVsLmdldFdlYkdMQ29udGV4dDtcbkdlc3NvLmVycm9yID0gbG9nZ2luZy5lcnJvcjtcbkdlc3NvLmluZm8gPSBsb2dnaW5nLmluZm87XG5HZXNzby5sb2cgPSBsb2dnaW5nLmxvZztcbkdlc3NvLndhcm4gPSBsb2dnaW5nLndhcm47XG5HZXNzby5wcm90b3R5cGUuaW5pdGlhbGl6ZSA9IGZ1bmN0aW9uIGluaXRpYWxpemUoKSB7XG4gIGlmICh0aGlzLl9pbml0aWFsaXplZCkge1xuICAgIHJldHVybjtcbiAgfVxuICB0aGlzLl9pbml0aWFsaXplZCA9IHRydWU7XG4gIHRoaXMuc2V0dXAuaW52b2tlKCk7XG59O1xuR2Vzc28ucHJvdG90eXBlLnN0ZXAgPSBmdW5jdGlvbiBzdGVwKGNvbnRleHQpIHtcbiAgdGhpcy5uZXh0RnJhbWUoKTtcbiAgdGhpcy5yZW5kZXJUbyhjb250ZXh0KTtcbn07XG5HZXNzby5wcm90b3R5cGUubmV4dEZyYW1lID0gZnVuY3Rpb24gbmV4dEZyYW1lKCkge1xuICByZXR1cm4gdGhpcy51cGRhdGUuaW52b2tlKCk7XG59O1xuR2Vzc28ucHJvdG90eXBlLnJlbmRlclRvID0gZnVuY3Rpb24gcmVuZGVyVG8oY29udGV4dCkge1xuICByZXR1cm4gdGhpcy5yZW5kZXIuaW52b2tlKGNvbnRleHQpO1xufTtcbkdlc3NvLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbiBydW4oY2FudmFzKSB7XG4gIHZhciBjb250cm9sbGVyID0gbmV3IENvbnRyb2xsZXIodGhpcywgY2FudmFzKTtcbiAgY29udHJvbGxlci5zdGFydCgpO1xuICByZXR1cm4gY29udHJvbGxlcjtcbn07XG5cblxubW9kdWxlLmV4cG9ydHMgPSBHZXNzbztcbiIsInZhciBHZXNzbyA9IHJlcXVpcmUoJy4vZ2Vzc28nKTtcblxuLy8gVE9ETzogRGVsZXRlIHRoaXNcbndpbmRvdy5HZXNzbyA9IEdlc3NvO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEdlc3NvO1xuIiwiLyogZ2xvYmFscyAkICovXG5cblxuLy8gVE9ETzogTG9nZ2VyIGNsYXNzXG4vLyBUT0RPOiBQbHVnZ2FibGUgbG9nIGJhY2tlbmQsIGUuZy4gY29uc29sZS5sb2dcblxuXG5mdW5jdGlvbiBfc2VuZChsZXZlbCwgYXJncykge1xuICAvLyBUT0RPOiBJbnNwZWN0IG9iamVjdCBpbnN0ZWFkIG9mIHNlbmRpbmcgW29iamVjdCBPYmplY3RdXG4gIC8vIFRPRE86IFJlbW92ZSB0aGUgaW1wbGllZCBqUXVlcnkgZGVwZW5kZW5jeVxuICAkLnBvc3QoJy9sb2cnLCB7XG4gICAgbGV2ZWw6IGxldmVsLFxuICAgIG1lc3NhZ2U6IGFyZ3Muam9pbignICcpXG4gIH0pLmZhaWwoZnVuY3Rpb24oeGhyLCB0ZXh0U3RhdHVzLCBlcnJvclRocm93bikge1xuICAgIC8vIFRPRE86IE5vdGlmeSB1c2VyIG9uIHRoZSBwYWdlIGFuZCBzaG93IG1lc3NhZ2UgaWYgY29uc29sZS5sb2cgZG9lc24ndCBleGlzdFxuICAgIGlmIChjb25zb2xlICYmIGNvbnNvbGUubG9nKSB7XG4gICAgICBjb25zb2xlLmxvZyh4aHIucmVzcG9uc2VUZXh0KTtcbiAgICB9XG4gIH0pO1xufVxuXG5cbmZ1bmN0aW9uIGVycm9yKG1lc3NhZ2UpIHtcbiAgcmV0dXJuIF9zZW5kKCdlcnJvcicsIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cykpO1xufVxuXG5cbmZ1bmN0aW9uIGluZm8obWVzc2FnZSkge1xuICByZXR1cm4gX3NlbmQoJ2luZm8nLCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpKTtcbn1cblxuXG5mdW5jdGlvbiBsb2cobWVzc2FnZSkge1xuICByZXR1cm4gX3NlbmQoJ2xvZycsIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cykpO1xufVxuXG5cbmZ1bmN0aW9uIHdhcm4obWVzc2FnZSkge1xuICByZXR1cm4gX3NlbmQoJ3dhcm4nLCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpKTtcbn1cblxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgZXJyb3I6IGVycm9yLFxuICBpbmZvOiBpbmZvLFxuICBsb2c6IGxvZyxcbiAgd2Fybjogd2FyblxufTtcbiIsInZhciByYWYgPSAoZnVuY3Rpb24gKCkge1xuICAvLyBSYWYgcG9seWZpbGwgYnkgRXJpayBNw7ZsbGVyLiBmaXhlcyBmcm9tIFBhdWwgSXJpc2ggYW5kIFRpbm8gWmlqZGVsXG4gIC8vIEFkYXB0ZWQgYnkgSm9lIEVzcG9zaXRvXG4gIC8vIE9yaWdpbjogaHR0cDovL3BhdWxpcmlzaC5jb20vMjAxMS9yZXF1ZXN0YW5pbWF0aW9uZnJhbWUtZm9yLXNtYXJ0LWFuaW1hdGluZy9cbiAgLy8gICAgICAgICBodHRwOi8vbXkub3BlcmEuY29tL2Vtb2xsZXIvYmxvZy8yMDExLzEyLzIwL3JlcXVlc3RhbmltYXRpb25mcmFtZS1mb3Itc21hcnQtZXItYW5pbWF0aW5nXG4gIC8vIE1JVCBsaWNlbnNlXG5cbiAgdmFyIHJlcXVlc3RBbmltYXRpb25GcmFtZSA9IHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnID8gd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSA6IG51bGw7XG4gIHZhciBjYW5jZWxBbmltYXRpb25GcmFtZSA9IHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnID8gd2luZG93LmNhbmNlbEFuaW1hdGlvbkZyYW1lIDogbnVsbDtcblxuICB2YXIgdmVuZG9ycyA9IFsnbXMnLCAnbW96JywgJ3dlYmtpdCcsICdvJ107XG4gIGZvcih2YXIgeCA9IDA7IHggPCB2ZW5kb3JzLmxlbmd0aCAmJiAhcmVxdWVzdEFuaW1hdGlvbkZyYW1lOyArK3gpIHtcbiAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSB3aW5kb3dbdmVuZG9yc1t4XSArICdSZXF1ZXN0QW5pbWF0aW9uRnJhbWUnXTtcbiAgICBjYW5jZWxBbmltYXRpb25GcmFtZSA9IHdpbmRvd1t2ZW5kb3JzW3hdICsgJ0NhbmNlbEFuaW1hdGlvbkZyYW1lJ10gfHwgd2luZG93W3ZlbmRvcnNbeF0gKyAnQ2FuY2VsUmVxdWVzdEFuaW1hdGlvbkZyYW1lJ107XG4gIH1cblxuICBpZiAoIXJlcXVlc3RBbmltYXRpb25GcmFtZSkge1xuICAgIHZhciBsYXN0VGltZSA9IDA7XG4gICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICAgIHZhciBjdXJyVGltZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuICAgICAgdmFyIHRpbWVUb0NhbGwgPSBNYXRoLm1heCgwLCAxNiAtIChjdXJyVGltZSAtIGxhc3RUaW1lKSk7XG4gICAgICB2YXIgaWQgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkgeyBjYWxsYmFjayhjdXJyVGltZSArIHRpbWVUb0NhbGwpOyB9LCB0aW1lVG9DYWxsKTtcbiAgICAgIGxhc3RUaW1lID0gY3VyclRpbWUgKyB0aW1lVG9DYWxsO1xuICAgICAgcmV0dXJuIGlkO1xuICAgIH07XG5cbiAgICBjYW5jZWxBbmltYXRpb25GcmFtZSA9IGZ1bmN0aW9uKGlkKSB7XG4gICAgICBjbGVhclRpbWVvdXQoaWQpO1xuICAgIH07XG4gIH1cblxuICByZXR1cm4ge1xuICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZTogZnVuY3Rpb24oY2FsbGJhY2spIHsgcmV0dXJuIHJlcXVlc3RBbmltYXRpb25GcmFtZShjYWxsYmFjayk7IH0sXG4gICAgY2FuY2VsQW5pbWF0aW9uRnJhbWU6IGZ1bmN0aW9uKHJlcXVlc3RJRCkgeyByZXR1cm4gY2FuY2VsQW5pbWF0aW9uRnJhbWUocmVxdWVzdElEKTsgfVxuICB9O1xufSkoKTtcblxuXG5mdW5jdGlvbiBnZXRDYW52YXMoKSB7XG4gIC8vIFRPRE86IEV4dHJhY3QgdGhpcyBvdXQgdG8gYnJlYWsgZGVwZW5kZW5jeVxuICBpZiAodHlwZW9mIHdpbmRvdyA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBnZXQgY2FudmFzIG91dHNpZGUgb2YgYnJvd3NlciBjb250ZXh0LicpO1xuICB9XG5cbiAgLy8gVE9ETzogUmVhZCB0aGUgcHJvamVjdCBzZXR0aW5ncyB1c2UgdGhlIHJpZ2h0IElEXG4gIHZhciBjYW52YXMgPSB3aW5kb3cuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dlc3NvLXRhcmdldCcpO1xuXG4gIGlmICghY2FudmFzKSB7XG4gICAgdmFyIGNhbnZhc2VzID0gd2luZG93LmRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdjYW52YXMnKTtcbiAgICBpZiAoY2FudmFzZXMubGVuZ3RoID09PSAxKSB7XG4gICAgICBjYW52YXMgPSBjYW52YXNlc1swXTtcbiAgICB9XG4gIH1cblxuICBpZiAoIWNhbnZhcykge1xuICAgIHRocm93IG5ldyBFcnJvcignQ2FudmFzIG5vdCBmb3VuZC4nKTtcbiAgfVxuXG4gIHJldHVybiBjYW52YXM7XG59XG5cblxuZnVuY3Rpb24gZ2V0Q29udGV4dDJEKCkge1xuICByZXR1cm4gZ2V0Q2FudmFzKCkuZ2V0Q29udGV4dCgnMmQnKTtcbn1cblxuXG5mdW5jdGlvbiBnZXRXZWJHTENvbnRleHQoKSB7XG4gIHJldHVybiBnZXRDYW52YXMoKS5nZXRDb250ZXh0KCd3ZWJnbCcpO1xufVxuXG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICByZXF1ZXN0QW5pbWF0aW9uRnJhbWU6IHJhZi5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUsXG4gIGNhbmNlbEFuaW1hdGlvbkZyYW1lOiByYWYuY2FuY2VsQW5pbWF0aW9uRnJhbWUsXG4gIGdldENhbnZhczogZ2V0Q2FudmFzLFxuICBnZXRDb250ZXh0MkQ6IGdldENvbnRleHQyRCxcbiAgZ2V0V2ViR0xDb250ZXh0OiBnZXRXZWJHTENvbnRleHRcbn07XG4iLCJmdW5jdGlvbiBmb3JFYWNoKGFycmF5LCBzdGVwRnVuY3Rpb24pIHtcbiAgZm9yICh2YXIgaW5kZXggPSAwOyBpbmRleCA8IGFycmF5Lmxlbmd0aDsgaW5kZXgrKykge1xuICAgIHN0ZXBGdW5jdGlvbihhcnJheVtpbmRleF0pO1xuICB9XG59XG5cblxuZnVuY3Rpb24gcG9wKGFycmF5LCBpbmRleCkge1xuICByZXR1cm4gdHlwZW9mIGluZGV4ID09PSAndW5kZWZpbmVkJyA/IGFycmF5LnBvcCgpIDogYXJyYXkuc3BsaWNlKGluZGV4LCAxKVswXTtcbn1cblxuXG5mdW5jdGlvbiBpbmRleE9mKGFycmF5LCBpdGVtLCBzdGFydEluZGV4KSB7XG4gIGZvciAodmFyIGluZGV4ID0gc3RhcnRJbmRleCB8fCAwOyBpbmRleCA8IGFycmF5Lmxlbmd0aDsgaW5kZXgrKykge1xuICAgIGlmIChhcnJheVtpbmRleF0gPT09IGl0ZW0pIHtcbiAgICAgIHJldHVybiBpbmRleDtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIC0xO1xufVxuXG5cbmZ1bmN0aW9uIGxhc3RJbmRleE9mKGFycmF5LCBpdGVtLCBzdGFydEluZGV4KSB7XG4gIGZvciAodmFyIGluZGV4ID0gc3RhcnRJbmRleCB8fCBhcnJheS5sZW5ndGggLSAxOyBpbmRleCA+PSAwOyBpbmRleC0tKSB7XG4gICAgaWYgKGFycmF5W2luZGV4XSA9PT0gaXRlbSkge1xuICAgICAgcmV0dXJuIGluZGV4O1xuICAgIH1cbiAgfVxuICByZXR1cm4gLTE7XG59XG5cblxuZnVuY3Rpb24gcmVtb3ZlKGFycmF5LCBpdGVtKSB7XG4gIHZhciBpbmRleCA9IGluZGV4T2YoYXJyYXksIGl0ZW0pO1xuICByZXR1cm4gaW5kZXggIT09IC0xID8gcG9wKGFycmF5LCBpbmRleCkgOiBudWxsO1xufVxuXG5cbmZ1bmN0aW9uIHJlbW92ZUxhc3QoYXJyYXksIGl0ZW0pIHtcbiAgdmFyIGluZGV4ID0gbGFzdEluZGV4T2YoYXJyYXksIGl0ZW0pO1xuICByZXR1cm4gaW5kZXggIT09IC0xID8gcG9wKGFycmF5LCBpbmRleCkgOiBudWxsO1xufVxuXG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBmb3JFYWNoOiBmb3JFYWNoLFxuICBwb3A6IHBvcCxcbiAgaW5kZXhPZjogaW5kZXhPZixcbiAgbGFzdEluZGV4T2Y6IGxhc3RJbmRleE9mLFxuICByZW1vdmU6IHJlbW92ZSxcbiAgcmVtb3ZlTGFzdDogcmVtb3ZlTGFzdFxufTtcbiIsIi8vIEdlc3NvIEVudHJ5IFBvaW50XG4vLyBEZXRlY3Qgd2hldGhlciB0aGlzIGlzIGNhbGxlZCBmcm9tIHRoZSBicm93c2VyLCBvciBmcm9tIHRoZSBDTEkuXG5cblxuaWYgKHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnKSB7XG4gIC8vIFVzZSBtb2R1bGUucmVxdWlyZSBzbyB0aGUgY2xpZW50LXNpZGUgYnVpbGQgc2tpcHMgb3ZlciBzZXJ2ZXIgY29kZSxcbiAgLy8gd2hpY2ggd2lsbCB3b3JrIHByb3Blcmx5IGF0IHJ1bnRpbWUgc2luY2Ugbm8gd2luZG93IGdsb2JhbCBpcyBkZWZpbmVkXG4gIG1vZHVsZS5leHBvcnRzID0gbW9kdWxlLnJlcXVpcmUoJy4vZ2Vzc28nKTtcbn0gZWxzZSB7XG4gIC8vIEluY2x1ZGUgaW4gY2xpZW50LXNpZGUgYnVpbGQsXG4gIC8vIHdoaWNoIHdpbGwgaGF2ZSBhIHdpbmRvdyBnbG9iYWwgZGVmaW5lZCBhdCBydW50aW1lXG4gIG1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9jbGllbnQnKTtcbn1cbiJdfQ==
