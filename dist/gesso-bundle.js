(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var Gesso = require('gesso');
var fillRotatedRect = require('./helpers').fillRotatedRect;

var game = new Gesso();
var radians = 0;
var radiansMaxSpeed = 1 / 60.0;
var radiansSpeed = radiansMaxSpeed;
var radiansAccel = 0.001;

Gesso.getCanvas().addEventListener('mousedown', function (e) {
  e.preventDefault();

  radiansSpeed = -5 / 60.0;

  return false;
});

game.update(function () {
  if (radiansSpeed < radiansMaxSpeed) {
    radiansSpeed += radiansAccel;
  }
  if (radiansSpeed > radiansMaxSpeed) {
    radiansSpeed = radiansMaxSpeed;
  }

  radians += radiansSpeed;
});

game.render(function (ctx) {
  var angle = radians * (Math.PI / 2);

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

game.run();

},{"./helpers":2,"gesso":10}],2:[function(require,module,exports){
module.exports = {
  // Draws a rectangle rotated at the specified angle (in radians)
  fillRotatedRect: function (ctx, x, y, width, height, angle) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uXFwuLlxcLi5cXC4uXFxQcm9qZWN0c1xcR2Vzc28uanNcXG5vZGVfbW9kdWxlc1xcYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyLXBhY2tcXF9wcmVsdWRlLmpzIiwiaW5kZXguanMiLCJoZWxwZXJzLmpzIiwibm9kZV9tb2R1bGVzL2dlc3NvL2NsaWVudC9jb250cm9sbGVyLmpzIiwibm9kZV9tb2R1bGVzL2dlc3NvL2NsaWVudC9kZWxlZ2F0ZS5qcyIsIm5vZGVfbW9kdWxlcy9nZXNzby9jbGllbnQvZ2Vzc28uanMiLCJub2RlX21vZHVsZXMvZ2Vzc28vY2xpZW50L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2dlc3NvL2NsaWVudC9sb2dnaW5nLmpzIiwibm9kZV9tb2R1bGVzL2dlc3NvL2NsaWVudC9sb3dMZXZlbC5qcyIsIm5vZGVfbW9kdWxlcy9nZXNzby9jbGllbnQvdXRpbC5qcyIsIm5vZGVfbW9kdWxlcy9nZXNzby9pbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIEdlc3NvID0gcmVxdWlyZSgnZ2Vzc28nKTtcclxudmFyIGZpbGxSb3RhdGVkUmVjdCA9IHJlcXVpcmUoJy4vaGVscGVycycpLmZpbGxSb3RhdGVkUmVjdDtcclxuXHJcbnZhciBnYW1lID0gbmV3IEdlc3NvKCk7XHJcbnZhciByYWRpYW5zID0gMDtcclxudmFyIHJhZGlhbnNNYXhTcGVlZCA9IDEgLyA2MC4wO1xyXG52YXIgcmFkaWFuc1NwZWVkID0gcmFkaWFuc01heFNwZWVkO1xyXG52YXIgcmFkaWFuc0FjY2VsID0gMC4wMDE7XHJcblxyXG5HZXNzby5nZXRDYW52YXMoKS5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCBmdW5jdGlvbiAoZSkge1xyXG4gIGUucHJldmVudERlZmF1bHQoKTtcclxuXHJcbiAgcmFkaWFuc1NwZWVkID0gLTUgLyA2MC4wO1xyXG5cclxuICByZXR1cm4gZmFsc2U7XHJcbn0pO1xyXG5cclxuZ2FtZS51cGRhdGUoZnVuY3Rpb24gKCkge1xyXG4gIGlmIChyYWRpYW5zU3BlZWQgPCByYWRpYW5zTWF4U3BlZWQpIHtcclxuICAgIHJhZGlhbnNTcGVlZCArPSByYWRpYW5zQWNjZWw7XHJcbiAgfVxyXG4gIGlmIChyYWRpYW5zU3BlZWQgPiByYWRpYW5zTWF4U3BlZWQpIHtcclxuICAgIHJhZGlhbnNTcGVlZCA9IHJhZGlhbnNNYXhTcGVlZDtcclxuICB9XHJcblxyXG4gIHJhZGlhbnMgKz0gcmFkaWFuc1NwZWVkO1xyXG59KTtcclxuXHJcbmdhbWUucmVuZGVyKGZ1bmN0aW9uIChjdHgpIHtcclxuICB2YXIgYW5nbGUgPSByYWRpYW5zICogKE1hdGguUEkgLyAyKTtcclxuXHJcbiAgLy8gQ2xlYXIgdGhlIGNhbnZhc1xyXG4gIGN0eC5jbGVhclJlY3QoMCwgMCwgZ2FtZS53aWR0aCwgZ2FtZS5oZWlnaHQpO1xyXG5cclxuICAvLyBEcmF3IGEgcmVkIGJveCwgcm90YXRpbmcgZm91ciB0aW1lcyBwZXIgc2Vjb25kXHJcbiAgY3R4LmZpbGxTdHlsZSA9ICcjZjM0JztcclxuICBmaWxsUm90YXRlZFJlY3QoY3R4LCA1MCwgMTAwLCAyMDAsIDIwLCBhbmdsZSAqIDQpO1xyXG5cclxuICAvLyBEcmF3IGEgZ3JlZW4gYm94LCBmdWxseSByb3RhdGluZyBldmVyeSB0d28gc2Vjb25kc1xyXG4gIGN0eC5maWxsU3R5bGUgPSAnI2NmOCc7XHJcbiAgZmlsbFJvdGF0ZWRSZWN0KGN0eCwgNDAwLCA1MCwgMjAwLCAxNTAsIC1hbmdsZSAvIDIpO1xyXG5cclxuICAvLyBEcmF3IGEgYmx1ZSBib3gsIGZ1bGx5IHJvdGF0aW5nIHR3byB0aW1lcyBwZXIgc2Vjb25kXHJcbiAgY3R4LmZpbGxTdHlsZSA9ICcjM2NmJztcclxuICBmaWxsUm90YXRlZFJlY3QoY3R4LCAyMDAsIDI1MCwgMjAwLCAyMDAsIGFuZ2xlICogMik7XHJcbn0pO1xyXG5cclxuZ2FtZS5ydW4oKTtcclxuIiwibW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgLy8gRHJhd3MgYSByZWN0YW5nbGUgcm90YXRlZCBhdCB0aGUgc3BlY2lmaWVkIGFuZ2xlIChpbiByYWRpYW5zKVxyXG4gIGZpbGxSb3RhdGVkUmVjdDogZnVuY3Rpb24gKGN0eCwgeCwgeSwgd2lkdGgsIGhlaWdodCwgYW5nbGUpIHtcclxuICAgIC8vIEdldCB0aGUgb3JpZ2luIG9mIHRoZSByZWN0YW5nbGUgYXJvdW5kIGl0cyBjZW50ZXJcclxuICAgIHZhciBvcmlnaW5YID0gd2lkdGggLyAyO1xyXG4gICAgdmFyIG9yaWdpblkgPSBoZWlnaHQgLyAyO1xyXG5cclxuICAgIC8vIFNhdmUgdGhlIHVucm90YXRlZCBjb250ZXh0IG9mIHRoZSBjYW52YXMgc28gd2UgY2FuIHJlc3RvcmUgaXQgbGF0ZXJcclxuICAgIGN0eC5zYXZlKCk7XHJcblxyXG4gICAgLy8gUm90YXRlIHRoZSBhcm91bmQgdGhlIG9yaWdpbiwgZ2l2ZW4gdGhlIHNwZWNpZmllZCBvZmZzZXRcclxuICAgIGN0eC50cmFuc2xhdGUoeCArIG9yaWdpblgsIHkgKyBvcmlnaW5ZKTtcclxuICAgIGN0eC5yb3RhdGUoYW5nbGUpO1xyXG5cclxuICAgIC8vIEFmdGVyIHRyYW5zZm9ybWluZywgKDAsMCkgaXMgdmlzdWFsbHkgKC1vcmlnaW5YLC1vcmlnaW5ZKSwgc28gdGhlIGJveFxyXG4gICAgLy8gbmVlZHMgdG8gYmUgb2Zmc2V0IGFjY29yZGluZ2x5XHJcbiAgICBjdHguZmlsbFJlY3QoLW9yaWdpblgsIC1vcmlnaW5ZLCB3aWR0aCwgaGVpZ2h0KTtcclxuXHJcbiAgICAgLy8gV2UncmUgZG9uZSB3aXRoIHRoZSByb3RhdGluZywgc28gcmVzdG9yZSB0byB0aGUgdW5yb3RhdGVkIGNvbnRleHRcclxuICAgIGN0eC5yZXN0b3JlKCk7XHJcbiAgfVxyXG59O1xyXG4iLCJ2YXIgbG93TGV2ZWwgPSByZXF1aXJlKCcuL2xvd0xldmVsJyk7XHJcblxyXG5cclxuZnVuY3Rpb24gQ29udHJvbGxlcihnZXNzbywgY2FudmFzKSB7XHJcbiAgdGhpcy5nZXNzbyA9IGdlc3NvO1xyXG4gIHRoaXMuX2NhbnZhcyA9IGNhbnZhcyB8fCBsb3dMZXZlbC5nZXRDYW52YXMoKTtcclxuICB0aGlzLl9jb250ZXh0ID0gdGhpcy5fY2FudmFzLmdldENvbnRleHQoJzJkJyk7XHJcbiAgdGhpcy5fcnVubmluZyA9IG51bGw7XHJcbiAgdGhpcy5fcmVxdWVzdElkID0gbnVsbDtcclxufVxyXG5Db250cm9sbGVyLnByb3RvdHlwZS5zdGVwT25jZSA9IGZ1bmN0aW9uICh0aW1lc3RhbXApIHtcclxuICB0aGlzLmdlc3NvLnN0ZXAodGhpcy5fY29udGV4dCk7XHJcbn07XHJcbkNvbnRyb2xsZXIucHJvdG90eXBlLmNvbnRpbnVlT24gPSBmdW5jdGlvbiAodGltZXN0YW1wKSB7XHJcbiAgdGhpcy5zdGVwT25jZSgpO1xyXG5cclxuICB2YXIgc2VsZiA9IHRoaXM7XHJcbiAgc2VsZi5fcmVxdWVzdElkID0gbG93TGV2ZWwucmVxdWVzdEFuaW1hdGlvbkZyYW1lKGZ1bmN0aW9uICh0aW1lc3RhbXApIHtcclxuICAgIHNlbGYuX3JlcXVlc3RJZCA9IG51bGw7XHJcbiAgICBpZiAoIXNlbGYuX3J1bm5pbmcpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgLy8gVE9ETzogRlBTXHJcbiAgICBzZWxmLmNvbnRpbnVlT24oKTtcclxuICB9KTtcclxufTtcclxuQ29udHJvbGxlci5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbiBzdGFydCgpIHtcclxuICBpZiAodGhpcy5fcnVubmluZykge1xyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuICB0aGlzLl9ydW5uaW5nID0gdHJ1ZTtcclxuXHJcbiAgdGhpcy5nZXNzby5pbml0aWFsaXplKCk7XHJcbiAgdGhpcy5nZXNzby5zdGFydC5pbnZva2UoKTtcclxuICAvLyBUT0RPOiBVc2UgYSBzY2hlZHVsZXJcclxuICB0aGlzLmNvbnRpbnVlT24oKTtcclxufTtcclxuQ29udHJvbGxlci5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uIHN0b3AoKSB7XHJcbiAgaWYgKCF0aGlzLl9ydW5uaW5nKSB7XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG4gIHRoaXMuX3J1bm5pbmcgPSBmYWxzZTtcclxuXHJcbiAgbG93TGV2ZWwuY2FuY2VsQW5pbWF0aW9uRnJhbWUodGhpcy5fcmVxdWVzdElkKTtcclxuICB0aGlzLl9yZXF1ZXN0SWQgPSBudWxsO1xyXG4gIHRoaXMuZ2Vzc28uc3RvcC5pbnZva2UoKTtcclxufTtcclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IENvbnRyb2xsZXI7XHJcbiIsInZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyk7XHJcblxyXG5cclxuLy8gUmV0dXJucyBhIGNhbGxhYmxlIG9iamVjdCB0aGF0LCB3aGVuIGNhbGxlZCB3aXRoIGEgZnVuY3Rpb24sIHN1YnNjcmliZXNcclxuLy8gdG8gdGhlIGRlbGVnYXRlLiBDYWxsIGludm9rZSBvbiB0aGlzIG9iamVjdCB0byBpbnZva2UgZWFjaCBoYW5kbGVyLlxyXG5mdW5jdGlvbiBEZWxlZ2F0ZSgpIHtcclxuICB2YXIgaGFuZGxlcnMgPSBbXTtcclxuXHJcbiAgZnVuY3Rpb24gY2FsbGFibGUoaGFuZGxlcikge1xyXG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggIT09IDEpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdEZWxlZ2F0ZSB0YWtlcyBleGFjdGx5IDEgYXJndW1lbnQgKCcgKyBhcmd1bWVudHMubGVuZ3RoICsgJyBnaXZlbiknKTtcclxuICAgIH0gZWxzZSBpZiAodHlwZW9mIGhhbmRsZXIgIT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdEZWxlZ2F0ZSBhcmd1bWVudCBtdXN0IGJlIGEgRnVuY3Rpb24gb2JqZWN0IChnb3QgJyArIHR5cGVvZiBoYW5kbGVyICsgJyknKTtcclxuICAgIH1cclxuICAgIGhhbmRsZXJzLnB1c2goaGFuZGxlcik7XHJcbiAgICByZXR1cm4gZnVuY3Rpb24gdW5zdWJzY3JpYmUoKSB7XHJcbiAgICAgIHJldHVybiB1dGlsLnJlbW92ZUxhc3QoaGFuZGxlcnMsIGhhbmRsZXIpO1xyXG4gICAgfTtcclxuICB9XHJcbiAgY2FsbGFibGUuaW52b2tlID0gZnVuY3Rpb24gaW52b2tlKCkge1xyXG4gICAgdmFyIGFyZ3MgPSBhcmd1bWVudHM7XHJcbiAgICB1dGlsLmZvckVhY2goaGFuZGxlcnMsIGZ1bmN0aW9uIChoYW5kbGVyKSB7XHJcbiAgICAgIGhhbmRsZXIuYXBwbHkobnVsbCwgYXJncyk7XHJcbiAgICB9KTtcclxuICB9O1xyXG4gIC8vIEV4cG9zZSBoYW5kbGVycyBmb3IgaW5zcGVjdGlvblxyXG4gIGNhbGxhYmxlLmhhbmRsZXJzID0gaGFuZGxlcnM7XHJcblxyXG4gIHJldHVybiBjYWxsYWJsZTtcclxufVxyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gRGVsZWdhdGU7XHJcbiIsInZhciBDb250cm9sbGVyID0gcmVxdWlyZSgnLi9jb250cm9sbGVyJyk7XHJcbnZhciBEZWxlZ2F0ZSA9IHJlcXVpcmUoJy4vZGVsZWdhdGUnKTtcclxudmFyIGxvd0xldmVsID0gcmVxdWlyZSgnLi9sb3dMZXZlbCcpO1xyXG52YXIgbG9nZ2luZyA9IHJlcXVpcmUoJy4vbG9nZ2luZycpO1xyXG5cclxuXHJcbmZ1bmN0aW9uIEdlc3NvKG9wdGlvbnMpIHtcclxuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcclxuICB0aGlzLmNvbnRleHRUeXBlID0gb3B0aW9ucy5jb250ZXh0VHlwZSB8fCAnMmQnO1xyXG4gIHRoaXMuY29udGV4dEF0dHJpYnV0ZXMgPSBvcHRpb25zLmNvbnRleHRBdHRyaWJ1dGVzO1xyXG4gIHRoaXMuZnBzID0gb3B0aW9ucy5mcHMgfHwgNjA7XHJcbiAgdGhpcy5hdXRvcGxheSA9IG9wdGlvbnMuYXV0b3BsYXkgfHwgdHJ1ZTtcclxuICB0aGlzLnNldHVwID0gbmV3IERlbGVnYXRlKCk7XHJcbiAgdGhpcy5zdGFydCA9IG5ldyBEZWxlZ2F0ZSgpO1xyXG4gIHRoaXMuc3RvcCA9IG5ldyBEZWxlZ2F0ZSgpO1xyXG4gIHRoaXMudXBkYXRlID0gbmV3IERlbGVnYXRlKCk7XHJcbiAgdGhpcy5yZW5kZXIgPSBuZXcgRGVsZWdhdGUoKTtcclxuICB0aGlzLndpZHRoID0gb3B0aW9ucy53aWR0aCB8fCA2NDA7ICAgIC8vIFRPRE86IGFsbG93ICdudWxsJyB0byB1c2Ugd2lkdGggb2YgdGFyZ2V0IGNhbnZhc1xyXG4gIHRoaXMuaGVpZ2h0ID0gb3B0aW9ucy5oZWlnaHQgfHwgNjQwOyAgLy8gVE9ETzogYWxsb3cgJ251bGwnIHRvIHVzZSBoZWlnaHQgb2YgdGFyZ2V0IGNhbnZhc1xyXG4gIHRoaXMuX2luaXRpYWxpemVkID0gZmFsc2U7XHJcbn1cclxuR2Vzc28uQ29udHJvbGxlciA9IENvbnRyb2xsZXI7XHJcbkdlc3NvLkRlbGVnYXRlID0gRGVsZWdhdGU7XHJcbkdlc3NvLnJlcXVlc3RBbmltYXRpb25GcmFtZSA9IGxvd0xldmVsLnJlcXVlc3RBbmltYXRpb25GcmFtZTtcclxuR2Vzc28uY2FuY2VsQW5pbWF0aW9uRnJhbWUgPSBsb3dMZXZlbC5jYW5jZWxBbmltYXRpb25GcmFtZTtcclxuR2Vzc28uZ2V0Q2FudmFzID0gbG93TGV2ZWwuZ2V0Q2FudmFzO1xyXG5HZXNzby5nZXRDb250ZXh0MkQgPSBsb3dMZXZlbC5nZXRDb250ZXh0MkQ7XHJcbkdlc3NvLmdldFdlYkdMQ29udGV4dCA9IGxvd0xldmVsLmdldFdlYkdMQ29udGV4dDtcclxuR2Vzc28uZXJyb3IgPSBsb2dnaW5nLmVycm9yO1xyXG5HZXNzby5pbmZvID0gbG9nZ2luZy5pbmZvO1xyXG5HZXNzby5sb2cgPSBsb2dnaW5nLmxvZztcclxuR2Vzc28ud2FybiA9IGxvZ2dpbmcud2FybjtcclxuR2Vzc28ucHJvdG90eXBlLmluaXRpYWxpemUgPSBmdW5jdGlvbiBpbml0aWFsaXplKCkge1xyXG4gIGlmICh0aGlzLl9pbml0aWFsaXplZCkge1xyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuICB0aGlzLl9pbml0aWFsaXplZCA9IHRydWU7XHJcbiAgdGhpcy5zZXR1cC5pbnZva2UoKTtcclxufTtcclxuR2Vzc28ucHJvdG90eXBlLnN0ZXAgPSBmdW5jdGlvbiBzdGVwKGNvbnRleHQpIHtcclxuICB0aGlzLm5leHRGcmFtZSgpO1xyXG4gIHRoaXMucmVuZGVyVG8oY29udGV4dCk7XHJcbn07XHJcbkdlc3NvLnByb3RvdHlwZS5uZXh0RnJhbWUgPSBmdW5jdGlvbiBuZXh0RnJhbWUoKSB7XHJcbiAgcmV0dXJuIHRoaXMudXBkYXRlLmludm9rZSgpO1xyXG59O1xyXG5HZXNzby5wcm90b3R5cGUucmVuZGVyVG8gPSBmdW5jdGlvbiByZW5kZXJUbyhjb250ZXh0KSB7XHJcbiAgcmV0dXJuIHRoaXMucmVuZGVyLmludm9rZShjb250ZXh0KTtcclxufTtcclxuR2Vzc28ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uIHJ1bihjYW52YXMpIHtcclxuICB2YXIgY29udHJvbGxlciA9IG5ldyBDb250cm9sbGVyKHRoaXMsIGNhbnZhcyk7XHJcbiAgY29udHJvbGxlci5zdGFydCgpO1xyXG4gIHJldHVybiBjb250cm9sbGVyO1xyXG59O1xyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gR2Vzc287XHJcbiIsInZhciBHZXNzbyA9IHJlcXVpcmUoJy4vZ2Vzc28nKTtcclxuXHJcbi8vIFRPRE86IERlbGV0ZSB0aGlzXHJcbndpbmRvdy5HZXNzbyA9IEdlc3NvO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBHZXNzbztcclxuIiwiLyogZ2xvYmFscyAkICovXHJcblxyXG5cclxuLy8gVE9ETzogTG9nZ2VyIGNsYXNzXHJcbi8vIFRPRE86IFBsdWdnYWJsZSBsb2cgYmFja2VuZCwgZS5nLiBjb25zb2xlLmxvZ1xyXG5cclxuXHJcbmZ1bmN0aW9uIF9zZW5kKGxldmVsLCBhcmdzKSB7XHJcbiAgLy8gVE9ETzogSW5zcGVjdCBvYmplY3QgaW5zdGVhZCBvZiBzZW5kaW5nIFtvYmplY3QgT2JqZWN0XVxyXG4gIC8vIFRPRE86IFJlbW92ZSB0aGUgaW1wbGllZCBqUXVlcnkgZGVwZW5kZW5jeVxyXG4gICQucG9zdCgnL2xvZycsIHtcclxuICAgIGxldmVsOiBsZXZlbCxcclxuICAgIG1lc3NhZ2U6IGFyZ3Muam9pbignICcpXHJcbiAgfSkuZmFpbChmdW5jdGlvbih4aHIsIHRleHRTdGF0dXMsIGVycm9yVGhyb3duKSB7XHJcbiAgICAvLyBUT0RPOiBOb3RpZnkgdXNlciBvbiB0aGUgcGFnZSBhbmQgc2hvdyBtZXNzYWdlIGlmIGNvbnNvbGUubG9nIGRvZXNuJ3QgZXhpc3RcclxuICAgIGlmIChjb25zb2xlICYmIGNvbnNvbGUubG9nKSB7XHJcbiAgICAgIGNvbnNvbGUubG9nKHhoci5yZXNwb25zZVRleHQpO1xyXG4gICAgfVxyXG4gIH0pO1xyXG59XHJcblxyXG5cclxuZnVuY3Rpb24gZXJyb3IobWVzc2FnZSkge1xyXG4gIHJldHVybiBfc2VuZCgnZXJyb3InLCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpKTtcclxufVxyXG5cclxuXHJcbmZ1bmN0aW9uIGluZm8obWVzc2FnZSkge1xyXG4gIHJldHVybiBfc2VuZCgnaW5mbycsIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cykpO1xyXG59XHJcblxyXG5cclxuZnVuY3Rpb24gbG9nKG1lc3NhZ2UpIHtcclxuICByZXR1cm4gX3NlbmQoJ2xvZycsIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cykpO1xyXG59XHJcblxyXG5cclxuZnVuY3Rpb24gd2FybihtZXNzYWdlKSB7XHJcbiAgcmV0dXJuIF9zZW5kKCd3YXJuJywgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKSk7XHJcbn1cclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICBlcnJvcjogZXJyb3IsXHJcbiAgaW5mbzogaW5mbyxcclxuICBsb2c6IGxvZyxcclxuICB3YXJuOiB3YXJuXHJcbn07XHJcbiIsInZhciByYWYgPSAoZnVuY3Rpb24gKCkge1xyXG4gIC8vIFJhZiBwb2x5ZmlsbCBieSBFcmlrIE3DtmxsZXIuIGZpeGVzIGZyb20gUGF1bCBJcmlzaCBhbmQgVGlubyBaaWpkZWxcclxuICAvLyBBZGFwdGVkIGJ5IEpvZSBFc3Bvc2l0b1xyXG4gIC8vIE9yaWdpbjogaHR0cDovL3BhdWxpcmlzaC5jb20vMjAxMS9yZXF1ZXN0YW5pbWF0aW9uZnJhbWUtZm9yLXNtYXJ0LWFuaW1hdGluZy9cclxuICAvLyAgICAgICAgIGh0dHA6Ly9teS5vcGVyYS5jb20vZW1vbGxlci9ibG9nLzIwMTEvMTIvMjAvcmVxdWVzdGFuaW1hdGlvbmZyYW1lLWZvci1zbWFydC1lci1hbmltYXRpbmdcclxuICAvLyBNSVQgbGljZW5zZVxyXG5cclxuICB2YXIgcmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgPyB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lIDogbnVsbDtcclxuICB2YXIgY2FuY2VsQW5pbWF0aW9uRnJhbWUgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyA/IHdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZSA6IG51bGw7XHJcblxyXG4gIHZhciB2ZW5kb3JzID0gWydtcycsICdtb3onLCAnd2Via2l0JywgJ28nXTtcclxuICBmb3IodmFyIHggPSAwOyB4IDwgdmVuZG9ycy5sZW5ndGggJiYgIXJlcXVlc3RBbmltYXRpb25GcmFtZTsgKyt4KSB7XHJcbiAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSB3aW5kb3dbdmVuZG9yc1t4XSArICdSZXF1ZXN0QW5pbWF0aW9uRnJhbWUnXTtcclxuICAgIGNhbmNlbEFuaW1hdGlvbkZyYW1lID0gd2luZG93W3ZlbmRvcnNbeF0gKyAnQ2FuY2VsQW5pbWF0aW9uRnJhbWUnXSB8fCB3aW5kb3dbdmVuZG9yc1t4XSArICdDYW5jZWxSZXF1ZXN0QW5pbWF0aW9uRnJhbWUnXTtcclxuICB9XHJcblxyXG4gIGlmICghcmVxdWVzdEFuaW1hdGlvbkZyYW1lKSB7XHJcbiAgICB2YXIgbGFzdFRpbWUgPSAwO1xyXG4gICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcclxuICAgICAgdmFyIGN1cnJUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XHJcbiAgICAgIHZhciB0aW1lVG9DYWxsID0gTWF0aC5tYXgoMCwgMTYgLSAoY3VyclRpbWUgLSBsYXN0VGltZSkpO1xyXG4gICAgICB2YXIgaWQgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkgeyBjYWxsYmFjayhjdXJyVGltZSArIHRpbWVUb0NhbGwpOyB9LCB0aW1lVG9DYWxsKTtcclxuICAgICAgbGFzdFRpbWUgPSBjdXJyVGltZSArIHRpbWVUb0NhbGw7XHJcbiAgICAgIHJldHVybiBpZDtcclxuICAgIH07XHJcblxyXG4gICAgY2FuY2VsQW5pbWF0aW9uRnJhbWUgPSBmdW5jdGlvbihpZCkge1xyXG4gICAgICBjbGVhclRpbWVvdXQoaWQpO1xyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIHJldHVybiB7XHJcbiAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWU6IGZ1bmN0aW9uKGNhbGxiYWNrKSB7IHJldHVybiByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoY2FsbGJhY2spOyB9LFxyXG4gICAgY2FuY2VsQW5pbWF0aW9uRnJhbWU6IGZ1bmN0aW9uKHJlcXVlc3RJRCkgeyByZXR1cm4gY2FuY2VsQW5pbWF0aW9uRnJhbWUocmVxdWVzdElEKTsgfVxyXG4gIH07XHJcbn0pKCk7XHJcblxyXG5cclxuZnVuY3Rpb24gZ2V0Q2FudmFzKCkge1xyXG4gIC8vIFRPRE86IEV4dHJhY3QgdGhpcyBvdXQgdG8gYnJlYWsgZGVwZW5kZW5jeVxyXG4gIGlmICh0eXBlb2Ygd2luZG93ID09PSAndW5kZWZpbmVkJykge1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgZ2V0IGNhbnZhcyBvdXRzaWRlIG9mIGJyb3dzZXIgY29udGV4dC4nKTtcclxuICB9XHJcblxyXG4gIC8vIFRPRE86IFJlYWQgdGhlIHByb2plY3Qgc2V0dGluZ3MgdXNlIHRoZSByaWdodCBJRFxyXG4gIHZhciBjYW52YXMgPSB3aW5kb3cuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dlc3NvLXRhcmdldCcpO1xyXG5cclxuICBpZiAoIWNhbnZhcykge1xyXG4gICAgdmFyIGNhbnZhc2VzID0gd2luZG93LmRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdjYW52YXMnKTtcclxuICAgIGlmIChjYW52YXNlcy5sZW5ndGggPT09IDEpIHtcclxuICAgICAgY2FudmFzID0gY2FudmFzZXNbMF07XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBpZiAoIWNhbnZhcykge1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKCdDYW52YXMgbm90IGZvdW5kLicpO1xyXG4gIH1cclxuXHJcbiAgcmV0dXJuIGNhbnZhcztcclxufVxyXG5cclxuXHJcbmZ1bmN0aW9uIGdldENvbnRleHQyRCgpIHtcclxuICByZXR1cm4gZ2V0Q2FudmFzKCkuZ2V0Q29udGV4dCgnMmQnKTtcclxufVxyXG5cclxuXHJcbmZ1bmN0aW9uIGdldFdlYkdMQ29udGV4dCgpIHtcclxuICByZXR1cm4gZ2V0Q2FudmFzKCkuZ2V0Q29udGV4dCgnd2ViZ2wnKTtcclxufVxyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gIHJlcXVlc3RBbmltYXRpb25GcmFtZTogcmFmLnJlcXVlc3RBbmltYXRpb25GcmFtZSxcclxuICBjYW5jZWxBbmltYXRpb25GcmFtZTogcmFmLmNhbmNlbEFuaW1hdGlvbkZyYW1lLFxyXG4gIGdldENhbnZhczogZ2V0Q2FudmFzLFxyXG4gIGdldENvbnRleHQyRDogZ2V0Q29udGV4dDJELFxyXG4gIGdldFdlYkdMQ29udGV4dDogZ2V0V2ViR0xDb250ZXh0XHJcbn07XHJcbiIsImZ1bmN0aW9uIGZvckVhY2goYXJyYXksIHN0ZXBGdW5jdGlvbikge1xyXG4gIGZvciAodmFyIGluZGV4ID0gMDsgaW5kZXggPCBhcnJheS5sZW5ndGg7IGluZGV4KyspIHtcclxuICAgIHN0ZXBGdW5jdGlvbihhcnJheVtpbmRleF0pO1xyXG4gIH1cclxufVxyXG5cclxuXHJcbmZ1bmN0aW9uIHBvcChhcnJheSwgaW5kZXgpIHtcclxuICByZXR1cm4gdHlwZW9mIGluZGV4ID09PSAndW5kZWZpbmVkJyA/IGFycmF5LnBvcCgpIDogYXJyYXkuc3BsaWNlKGluZGV4LCAxKVswXTtcclxufVxyXG5cclxuXHJcbmZ1bmN0aW9uIGluZGV4T2YoYXJyYXksIGl0ZW0sIHN0YXJ0SW5kZXgpIHtcclxuICBmb3IgKHZhciBpbmRleCA9IHN0YXJ0SW5kZXggfHwgMDsgaW5kZXggPCBhcnJheS5sZW5ndGg7IGluZGV4KyspIHtcclxuICAgIGlmIChhcnJheVtpbmRleF0gPT09IGl0ZW0pIHtcclxuICAgICAgcmV0dXJuIGluZGV4O1xyXG4gICAgfVxyXG4gIH1cclxuICByZXR1cm4gLTE7XHJcbn1cclxuXHJcblxyXG5mdW5jdGlvbiBsYXN0SW5kZXhPZihhcnJheSwgaXRlbSwgc3RhcnRJbmRleCkge1xyXG4gIGZvciAodmFyIGluZGV4ID0gc3RhcnRJbmRleCB8fCBhcnJheS5sZW5ndGggLSAxOyBpbmRleCA+PSAwOyBpbmRleC0tKSB7XHJcbiAgICBpZiAoYXJyYXlbaW5kZXhdID09PSBpdGVtKSB7XHJcbiAgICAgIHJldHVybiBpbmRleDtcclxuICAgIH1cclxuICB9XHJcbiAgcmV0dXJuIC0xO1xyXG59XHJcblxyXG5cclxuZnVuY3Rpb24gcmVtb3ZlKGFycmF5LCBpdGVtKSB7XHJcbiAgdmFyIGluZGV4ID0gaW5kZXhPZihhcnJheSwgaXRlbSk7XHJcbiAgcmV0dXJuIGluZGV4ICE9PSAtMSA/IHBvcChhcnJheSwgaW5kZXgpIDogbnVsbDtcclxufVxyXG5cclxuXHJcbmZ1bmN0aW9uIHJlbW92ZUxhc3QoYXJyYXksIGl0ZW0pIHtcclxuICB2YXIgaW5kZXggPSBsYXN0SW5kZXhPZihhcnJheSwgaXRlbSk7XHJcbiAgcmV0dXJuIGluZGV4ICE9PSAtMSA/IHBvcChhcnJheSwgaW5kZXgpIDogbnVsbDtcclxufVxyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gIGZvckVhY2g6IGZvckVhY2gsXHJcbiAgcG9wOiBwb3AsXHJcbiAgaW5kZXhPZjogaW5kZXhPZixcclxuICBsYXN0SW5kZXhPZjogbGFzdEluZGV4T2YsXHJcbiAgcmVtb3ZlOiByZW1vdmUsXHJcbiAgcmVtb3ZlTGFzdDogcmVtb3ZlTGFzdFxyXG59O1xyXG4iLCIvLyBHZXNzbyBFbnRyeSBQb2ludFxyXG4vLyBEZXRlY3Qgd2hldGhlciB0aGlzIGlzIGNhbGxlZCBmcm9tIHRoZSBicm93c2VyLCBvciBmcm9tIHRoZSBDTEkuXHJcblxyXG5cclxuaWYgKHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnKSB7XHJcbiAgLy8gVXNlIG1vZHVsZS5yZXF1aXJlIHNvIHRoZSBjbGllbnQtc2lkZSBidWlsZCBza2lwcyBvdmVyIHNlcnZlciBjb2RlLFxyXG4gIC8vIHdoaWNoIHdpbGwgd29yayBwcm9wZXJseSBhdCBydW50aW1lIHNpbmNlIG5vIHdpbmRvdyBnbG9iYWwgaXMgZGVmaW5lZFxyXG4gIG1vZHVsZS5leHBvcnRzID0gbW9kdWxlLnJlcXVpcmUoJy4vZ2Vzc28nKTtcclxufSBlbHNlIHtcclxuICAvLyBJbmNsdWRlIGluIGNsaWVudC1zaWRlIGJ1aWxkLFxyXG4gIC8vIHdoaWNoIHdpbGwgaGF2ZSBhIHdpbmRvdyBnbG9iYWwgZGVmaW5lZCBhdCBydW50aW1lXHJcbiAgbW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2NsaWVudCcpO1xyXG59XHJcbiJdfQ==
