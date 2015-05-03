(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var Gesso = require('gesso');
var fillRotatedRect = require('./helpers').fillRotatedRect;

var game = new Gesso();
var radians = 0;
var radiansMaxSpeed = 1 / 60.0;
var radiansSpeed = radiansMaxSpeed;
var radiansAccel = 0.001;

Gesso.getCanvas().addEventListener('mousedown', function (e) {
  e.stopPropagation();
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uXFwuLlxcLi5cXC4uXFxQcm9qZWN0c1xcR2Vzc28uanNcXG5vZGVfbW9kdWxlc1xcYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyLXBhY2tcXF9wcmVsdWRlLmpzIiwiaW5kZXguanMiLCJoZWxwZXJzLmpzIiwibm9kZV9tb2R1bGVzL2dlc3NvL2NsaWVudC9jb250cm9sbGVyLmpzIiwibm9kZV9tb2R1bGVzL2dlc3NvL2NsaWVudC9kZWxlZ2F0ZS5qcyIsIm5vZGVfbW9kdWxlcy9nZXNzby9jbGllbnQvZ2Vzc28uanMiLCJub2RlX21vZHVsZXMvZ2Vzc28vY2xpZW50L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2dlc3NvL2NsaWVudC9sb2dnaW5nLmpzIiwibm9kZV9tb2R1bGVzL2dlc3NvL2NsaWVudC9sb3dMZXZlbC5qcyIsIm5vZGVfbW9kdWxlcy9nZXNzby9jbGllbnQvdXRpbC5qcyIsIm5vZGVfbW9kdWxlcy9nZXNzby9pbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJ2YXIgR2Vzc28gPSByZXF1aXJlKCdnZXNzbycpO1xyXG52YXIgZmlsbFJvdGF0ZWRSZWN0ID0gcmVxdWlyZSgnLi9oZWxwZXJzJykuZmlsbFJvdGF0ZWRSZWN0O1xyXG5cclxudmFyIGdhbWUgPSBuZXcgR2Vzc28oKTtcclxudmFyIHJhZGlhbnMgPSAwO1xyXG52YXIgcmFkaWFuc01heFNwZWVkID0gMSAvIDYwLjA7XHJcbnZhciByYWRpYW5zU3BlZWQgPSByYWRpYW5zTWF4U3BlZWQ7XHJcbnZhciByYWRpYW5zQWNjZWwgPSAwLjAwMTtcclxuXHJcbkdlc3NvLmdldENhbnZhcygpLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIGZ1bmN0aW9uIChlKSB7XHJcbiAgZS5zdG9wUHJvcGFnYXRpb24oKTtcclxuICBlLnByZXZlbnREZWZhdWx0KCk7XHJcblxyXG4gIHJhZGlhbnNTcGVlZCA9IC01IC8gNjAuMDtcclxuXHJcbiAgcmV0dXJuIGZhbHNlO1xyXG59KTtcclxuXHJcbmdhbWUudXBkYXRlKGZ1bmN0aW9uICgpIHtcclxuICBpZiAocmFkaWFuc1NwZWVkIDwgcmFkaWFuc01heFNwZWVkKSB7XHJcbiAgICByYWRpYW5zU3BlZWQgKz0gcmFkaWFuc0FjY2VsO1xyXG4gIH1cclxuICBpZiAocmFkaWFuc1NwZWVkID4gcmFkaWFuc01heFNwZWVkKSB7XHJcbiAgICByYWRpYW5zU3BlZWQgPSByYWRpYW5zTWF4U3BlZWQ7XHJcbiAgfVxyXG5cclxuICByYWRpYW5zICs9IHJhZGlhbnNTcGVlZDtcclxufSk7XHJcblxyXG5nYW1lLnJlbmRlcihmdW5jdGlvbiAoY3R4KSB7XHJcbiAgdmFyIGFuZ2xlID0gcmFkaWFucyAqIChNYXRoLlBJIC8gMik7XHJcblxyXG4gIC8vIENsZWFyIHRoZSBjYW52YXNcclxuICBjdHguY2xlYXJSZWN0KDAsIDAsIGdhbWUud2lkdGgsIGdhbWUuaGVpZ2h0KTtcclxuXHJcbiAgLy8gRHJhdyBhIHJlZCBib3gsIHJvdGF0aW5nIGZvdXIgdGltZXMgcGVyIHNlY29uZFxyXG4gIGN0eC5maWxsU3R5bGUgPSAnI2YzNCc7XHJcbiAgZmlsbFJvdGF0ZWRSZWN0KGN0eCwgNTAsIDEwMCwgMjAwLCAyMCwgYW5nbGUgKiA0KTtcclxuXHJcbiAgLy8gRHJhdyBhIGdyZWVuIGJveCwgZnVsbHkgcm90YXRpbmcgZXZlcnkgdHdvIHNlY29uZHNcclxuICBjdHguZmlsbFN0eWxlID0gJyNjZjgnO1xyXG4gIGZpbGxSb3RhdGVkUmVjdChjdHgsIDQwMCwgNTAsIDIwMCwgMTUwLCAtYW5nbGUgLyAyKTtcclxuXHJcbiAgLy8gRHJhdyBhIGJsdWUgYm94LCBmdWxseSByb3RhdGluZyB0d28gdGltZXMgcGVyIHNlY29uZFxyXG4gIGN0eC5maWxsU3R5bGUgPSAnIzNjZic7XHJcbiAgZmlsbFJvdGF0ZWRSZWN0KGN0eCwgMjAwLCAyNTAsIDIwMCwgMjAwLCBhbmdsZSAqIDIpO1xyXG59KTtcclxuXHJcbmdhbWUucnVuKCk7XHJcbiIsIm1vZHVsZS5leHBvcnRzID0ge1xyXG4gIC8vIERyYXdzIGEgcmVjdGFuZ2xlIHJvdGF0ZWQgYXQgdGhlIHNwZWNpZmllZCBhbmdsZSAoaW4gcmFkaWFucylcclxuICBmaWxsUm90YXRlZFJlY3Q6IGZ1bmN0aW9uIChjdHgsIHgsIHksIHdpZHRoLCBoZWlnaHQsIGFuZ2xlKSB7XHJcbiAgICAvLyBHZXQgdGhlIG9yaWdpbiBvZiB0aGUgcmVjdGFuZ2xlIGFyb3VuZCBpdHMgY2VudGVyXHJcbiAgICB2YXIgb3JpZ2luWCA9IHdpZHRoIC8gMjtcclxuICAgIHZhciBvcmlnaW5ZID0gaGVpZ2h0IC8gMjtcclxuXHJcbiAgICAvLyBTYXZlIHRoZSB1bnJvdGF0ZWQgY29udGV4dCBvZiB0aGUgY2FudmFzIHNvIHdlIGNhbiByZXN0b3JlIGl0IGxhdGVyXHJcbiAgICBjdHguc2F2ZSgpO1xyXG5cclxuICAgIC8vIFJvdGF0ZSB0aGUgYXJvdW5kIHRoZSBvcmlnaW4sIGdpdmVuIHRoZSBzcGVjaWZpZWQgb2Zmc2V0XHJcbiAgICBjdHgudHJhbnNsYXRlKHggKyBvcmlnaW5YLCB5ICsgb3JpZ2luWSk7XHJcbiAgICBjdHgucm90YXRlKGFuZ2xlKTtcclxuXHJcbiAgICAvLyBBZnRlciB0cmFuc2Zvcm1pbmcsICgwLDApIGlzIHZpc3VhbGx5ICgtb3JpZ2luWCwtb3JpZ2luWSksIHNvIHRoZSBib3hcclxuICAgIC8vIG5lZWRzIHRvIGJlIG9mZnNldCBhY2NvcmRpbmdseVxyXG4gICAgY3R4LmZpbGxSZWN0KC1vcmlnaW5YLCAtb3JpZ2luWSwgd2lkdGgsIGhlaWdodCk7XHJcblxyXG4gICAgIC8vIFdlJ3JlIGRvbmUgd2l0aCB0aGUgcm90YXRpbmcsIHNvIHJlc3RvcmUgdG8gdGhlIHVucm90YXRlZCBjb250ZXh0XHJcbiAgICBjdHgucmVzdG9yZSgpO1xyXG4gIH1cclxufTtcclxuIiwidmFyIGxvd0xldmVsID0gcmVxdWlyZSgnLi9sb3dMZXZlbCcpO1xyXG5cclxuXHJcbmZ1bmN0aW9uIENvbnRyb2xsZXIoZ2Vzc28sIGNhbnZhcykge1xyXG4gIHRoaXMuZ2Vzc28gPSBnZXNzbztcclxuICB0aGlzLl9jYW52YXMgPSBjYW52YXMgfHwgbG93TGV2ZWwuZ2V0Q2FudmFzKCk7XHJcbiAgdGhpcy5fY29udGV4dCA9IHRoaXMuX2NhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xyXG4gIHRoaXMuX3J1bm5pbmcgPSBudWxsO1xyXG4gIHRoaXMuX3JlcXVlc3RJZCA9IG51bGw7XHJcbn1cclxuQ29udHJvbGxlci5wcm90b3R5cGUuc3RlcE9uY2UgPSBmdW5jdGlvbiAodGltZXN0YW1wKSB7XHJcbiAgdGhpcy5nZXNzby5zdGVwKHRoaXMuX2NvbnRleHQpO1xyXG59O1xyXG5Db250cm9sbGVyLnByb3RvdHlwZS5jb250aW51ZU9uID0gZnVuY3Rpb24gKHRpbWVzdGFtcCkge1xyXG4gIHRoaXMuc3RlcE9uY2UoKTtcclxuXHJcbiAgdmFyIHNlbGYgPSB0aGlzO1xyXG4gIHNlbGYuX3JlcXVlc3RJZCA9IGxvd0xldmVsLnJlcXVlc3RBbmltYXRpb25GcmFtZShmdW5jdGlvbiAodGltZXN0YW1wKSB7XHJcbiAgICBzZWxmLl9yZXF1ZXN0SWQgPSBudWxsO1xyXG4gICAgaWYgKCFzZWxmLl9ydW5uaW5nKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIC8vIFRPRE86IEZQU1xyXG4gICAgc2VsZi5jb250aW51ZU9uKCk7XHJcbiAgfSk7XHJcbn07XHJcbkNvbnRyb2xsZXIucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24gc3RhcnQoKSB7XHJcbiAgaWYgKHRoaXMuX3J1bm5pbmcpIHtcclxuICAgIHJldHVybjtcclxuICB9XHJcbiAgdGhpcy5fcnVubmluZyA9IHRydWU7XHJcblxyXG4gIHRoaXMuZ2Vzc28uaW5pdGlhbGl6ZSgpO1xyXG4gIHRoaXMuZ2Vzc28uc3RhcnQuaW52b2tlKCk7XHJcbiAgLy8gVE9ETzogVXNlIGEgc2NoZWR1bGVyXHJcbiAgdGhpcy5jb250aW51ZU9uKCk7XHJcbn07XHJcbkNvbnRyb2xsZXIucHJvdG90eXBlLnN0b3AgPSBmdW5jdGlvbiBzdG9wKCkge1xyXG4gIGlmICghdGhpcy5fcnVubmluZykge1xyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuICB0aGlzLl9ydW5uaW5nID0gZmFsc2U7XHJcblxyXG4gIGxvd0xldmVsLmNhbmNlbEFuaW1hdGlvbkZyYW1lKHRoaXMuX3JlcXVlc3RJZCk7XHJcbiAgdGhpcy5fcmVxdWVzdElkID0gbnVsbDtcclxuICB0aGlzLmdlc3NvLnN0b3AuaW52b2tlKCk7XHJcbn07XHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBDb250cm9sbGVyO1xyXG4iLCJ2YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpO1xyXG5cclxuXHJcbi8vIFJldHVybnMgYSBjYWxsYWJsZSBvYmplY3QgdGhhdCwgd2hlbiBjYWxsZWQgd2l0aCBhIGZ1bmN0aW9uLCBzdWJzY3JpYmVzXHJcbi8vIHRvIHRoZSBkZWxlZ2F0ZS4gQ2FsbCBpbnZva2Ugb24gdGhpcyBvYmplY3QgdG8gaW52b2tlIGVhY2ggaGFuZGxlci5cclxuZnVuY3Rpb24gRGVsZWdhdGUoKSB7XHJcbiAgdmFyIGhhbmRsZXJzID0gW107XHJcblxyXG4gIGZ1bmN0aW9uIGNhbGxhYmxlKGhhbmRsZXIpIHtcclxuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoICE9PSAxKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcignRGVsZWdhdGUgdGFrZXMgZXhhY3RseSAxIGFyZ3VtZW50ICgnICsgYXJndW1lbnRzLmxlbmd0aCArICcgZ2l2ZW4pJyk7XHJcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBoYW5kbGVyICE9PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcignRGVsZWdhdGUgYXJndW1lbnQgbXVzdCBiZSBhIEZ1bmN0aW9uIG9iamVjdCAoZ290ICcgKyB0eXBlb2YgaGFuZGxlciArICcpJyk7XHJcbiAgICB9XHJcbiAgICBoYW5kbGVycy5wdXNoKGhhbmRsZXIpO1xyXG4gICAgcmV0dXJuIGZ1bmN0aW9uIHVuc3Vic2NyaWJlKCkge1xyXG4gICAgICByZXR1cm4gdXRpbC5yZW1vdmVMYXN0KGhhbmRsZXJzLCBoYW5kbGVyKTtcclxuICAgIH07XHJcbiAgfVxyXG4gIGNhbGxhYmxlLmludm9rZSA9IGZ1bmN0aW9uIGludm9rZSgpIHtcclxuICAgIHZhciBhcmdzID0gYXJndW1lbnRzO1xyXG4gICAgdXRpbC5mb3JFYWNoKGhhbmRsZXJzLCBmdW5jdGlvbiAoaGFuZGxlcikge1xyXG4gICAgICBoYW5kbGVyLmFwcGx5KG51bGwsIGFyZ3MpO1xyXG4gICAgfSk7XHJcbiAgfTtcclxuICAvLyBFeHBvc2UgaGFuZGxlcnMgZm9yIGluc3BlY3Rpb25cclxuICBjYWxsYWJsZS5oYW5kbGVycyA9IGhhbmRsZXJzO1xyXG5cclxuICByZXR1cm4gY2FsbGFibGU7XHJcbn1cclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IERlbGVnYXRlO1xyXG4iLCJ2YXIgQ29udHJvbGxlciA9IHJlcXVpcmUoJy4vY29udHJvbGxlcicpO1xyXG52YXIgRGVsZWdhdGUgPSByZXF1aXJlKCcuL2RlbGVnYXRlJyk7XHJcbnZhciBsb3dMZXZlbCA9IHJlcXVpcmUoJy4vbG93TGV2ZWwnKTtcclxudmFyIGxvZ2dpbmcgPSByZXF1aXJlKCcuL2xvZ2dpbmcnKTtcclxuXHJcblxyXG5mdW5jdGlvbiBHZXNzbyhvcHRpb25zKSB7XHJcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XHJcbiAgdGhpcy5jb250ZXh0VHlwZSA9IG9wdGlvbnMuY29udGV4dFR5cGUgfHwgJzJkJztcclxuICB0aGlzLmNvbnRleHRBdHRyaWJ1dGVzID0gb3B0aW9ucy5jb250ZXh0QXR0cmlidXRlcztcclxuICB0aGlzLmZwcyA9IG9wdGlvbnMuZnBzIHx8IDYwO1xyXG4gIHRoaXMuYXV0b3BsYXkgPSBvcHRpb25zLmF1dG9wbGF5IHx8IHRydWU7XHJcbiAgdGhpcy5zZXR1cCA9IG5ldyBEZWxlZ2F0ZSgpO1xyXG4gIHRoaXMuc3RhcnQgPSBuZXcgRGVsZWdhdGUoKTtcclxuICB0aGlzLnN0b3AgPSBuZXcgRGVsZWdhdGUoKTtcclxuICB0aGlzLnVwZGF0ZSA9IG5ldyBEZWxlZ2F0ZSgpO1xyXG4gIHRoaXMucmVuZGVyID0gbmV3IERlbGVnYXRlKCk7XHJcbiAgdGhpcy53aWR0aCA9IG9wdGlvbnMud2lkdGggfHwgNjQwOyAgICAvLyBUT0RPOiBhbGxvdyAnbnVsbCcgdG8gdXNlIHdpZHRoIG9mIHRhcmdldCBjYW52YXNcclxuICB0aGlzLmhlaWdodCA9IG9wdGlvbnMuaGVpZ2h0IHx8IDY0MDsgIC8vIFRPRE86IGFsbG93ICdudWxsJyB0byB1c2UgaGVpZ2h0IG9mIHRhcmdldCBjYW52YXNcclxuICB0aGlzLl9pbml0aWFsaXplZCA9IGZhbHNlO1xyXG59XHJcbkdlc3NvLkNvbnRyb2xsZXIgPSBDb250cm9sbGVyO1xyXG5HZXNzby5EZWxlZ2F0ZSA9IERlbGVnYXRlO1xyXG5HZXNzby5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSBsb3dMZXZlbC5yZXF1ZXN0QW5pbWF0aW9uRnJhbWU7XHJcbkdlc3NvLmNhbmNlbEFuaW1hdGlvbkZyYW1lID0gbG93TGV2ZWwuY2FuY2VsQW5pbWF0aW9uRnJhbWU7XHJcbkdlc3NvLmdldENhbnZhcyA9IGxvd0xldmVsLmdldENhbnZhcztcclxuR2Vzc28uZ2V0Q29udGV4dDJEID0gbG93TGV2ZWwuZ2V0Q29udGV4dDJEO1xyXG5HZXNzby5nZXRXZWJHTENvbnRleHQgPSBsb3dMZXZlbC5nZXRXZWJHTENvbnRleHQ7XHJcbkdlc3NvLmVycm9yID0gbG9nZ2luZy5lcnJvcjtcclxuR2Vzc28uaW5mbyA9IGxvZ2dpbmcuaW5mbztcclxuR2Vzc28ubG9nID0gbG9nZ2luZy5sb2c7XHJcbkdlc3NvLndhcm4gPSBsb2dnaW5nLndhcm47XHJcbkdlc3NvLnByb3RvdHlwZS5pbml0aWFsaXplID0gZnVuY3Rpb24gaW5pdGlhbGl6ZSgpIHtcclxuICBpZiAodGhpcy5faW5pdGlhbGl6ZWQpIHtcclxuICAgIHJldHVybjtcclxuICB9XHJcbiAgdGhpcy5faW5pdGlhbGl6ZWQgPSB0cnVlO1xyXG4gIHRoaXMuc2V0dXAuaW52b2tlKCk7XHJcbn07XHJcbkdlc3NvLnByb3RvdHlwZS5zdGVwID0gZnVuY3Rpb24gc3RlcChjb250ZXh0KSB7XHJcbiAgdGhpcy5uZXh0RnJhbWUoKTtcclxuICB0aGlzLnJlbmRlclRvKGNvbnRleHQpO1xyXG59O1xyXG5HZXNzby5wcm90b3R5cGUubmV4dEZyYW1lID0gZnVuY3Rpb24gbmV4dEZyYW1lKCkge1xyXG4gIHJldHVybiB0aGlzLnVwZGF0ZS5pbnZva2UoKTtcclxufTtcclxuR2Vzc28ucHJvdG90eXBlLnJlbmRlclRvID0gZnVuY3Rpb24gcmVuZGVyVG8oY29udGV4dCkge1xyXG4gIHJldHVybiB0aGlzLnJlbmRlci5pbnZva2UoY29udGV4dCk7XHJcbn07XHJcbkdlc3NvLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbiBydW4oY2FudmFzKSB7XHJcbiAgdmFyIGNvbnRyb2xsZXIgPSBuZXcgQ29udHJvbGxlcih0aGlzLCBjYW52YXMpO1xyXG4gIGNvbnRyb2xsZXIuc3RhcnQoKTtcclxuICByZXR1cm4gY29udHJvbGxlcjtcclxufTtcclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEdlc3NvO1xyXG4iLCJ2YXIgR2Vzc28gPSByZXF1aXJlKCcuL2dlc3NvJyk7XHJcblxyXG4vLyBUT0RPOiBEZWxldGUgdGhpc1xyXG53aW5kb3cuR2Vzc28gPSBHZXNzbztcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gR2Vzc287XHJcbiIsIi8qIGdsb2JhbHMgJCAqL1xyXG5cclxuXHJcbi8vIFRPRE86IExvZ2dlciBjbGFzc1xyXG4vLyBUT0RPOiBQbHVnZ2FibGUgbG9nIGJhY2tlbmQsIGUuZy4gY29uc29sZS5sb2dcclxuXHJcblxyXG5mdW5jdGlvbiBfc2VuZChsZXZlbCwgYXJncykge1xyXG4gIC8vIFRPRE86IEluc3BlY3Qgb2JqZWN0IGluc3RlYWQgb2Ygc2VuZGluZyBbb2JqZWN0IE9iamVjdF1cclxuICAvLyBUT0RPOiBSZW1vdmUgdGhlIGltcGxpZWQgalF1ZXJ5IGRlcGVuZGVuY3lcclxuICAkLnBvc3QoJy9sb2cnLCB7XHJcbiAgICBsZXZlbDogbGV2ZWwsXHJcbiAgICBtZXNzYWdlOiBhcmdzLmpvaW4oJyAnKVxyXG4gIH0pLmZhaWwoZnVuY3Rpb24oeGhyLCB0ZXh0U3RhdHVzLCBlcnJvclRocm93bikge1xyXG4gICAgLy8gVE9ETzogTm90aWZ5IHVzZXIgb24gdGhlIHBhZ2UgYW5kIHNob3cgbWVzc2FnZSBpZiBjb25zb2xlLmxvZyBkb2Vzbid0IGV4aXN0XHJcbiAgICBpZiAoY29uc29sZSAmJiBjb25zb2xlLmxvZykge1xyXG4gICAgICBjb25zb2xlLmxvZyh4aHIucmVzcG9uc2VUZXh0KTtcclxuICAgIH1cclxuICB9KTtcclxufVxyXG5cclxuXHJcbmZ1bmN0aW9uIGVycm9yKG1lc3NhZ2UpIHtcclxuICByZXR1cm4gX3NlbmQoJ2Vycm9yJywgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKSk7XHJcbn1cclxuXHJcblxyXG5mdW5jdGlvbiBpbmZvKG1lc3NhZ2UpIHtcclxuICByZXR1cm4gX3NlbmQoJ2luZm8nLCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpKTtcclxufVxyXG5cclxuXHJcbmZ1bmN0aW9uIGxvZyhtZXNzYWdlKSB7XHJcbiAgcmV0dXJuIF9zZW5kKCdsb2cnLCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpKTtcclxufVxyXG5cclxuXHJcbmZ1bmN0aW9uIHdhcm4obWVzc2FnZSkge1xyXG4gIHJldHVybiBfc2VuZCgnd2FybicsIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cykpO1xyXG59XHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgZXJyb3I6IGVycm9yLFxyXG4gIGluZm86IGluZm8sXHJcbiAgbG9nOiBsb2csXHJcbiAgd2Fybjogd2FyblxyXG59O1xyXG4iLCJ2YXIgcmFmID0gKGZ1bmN0aW9uICgpIHtcclxuICAvLyBSYWYgcG9seWZpbGwgYnkgRXJpayBNw7ZsbGVyLiBmaXhlcyBmcm9tIFBhdWwgSXJpc2ggYW5kIFRpbm8gWmlqZGVsXHJcbiAgLy8gQWRhcHRlZCBieSBKb2UgRXNwb3NpdG9cclxuICAvLyBPcmlnaW46IGh0dHA6Ly9wYXVsaXJpc2guY29tLzIwMTEvcmVxdWVzdGFuaW1hdGlvbmZyYW1lLWZvci1zbWFydC1hbmltYXRpbmcvXHJcbiAgLy8gICAgICAgICBodHRwOi8vbXkub3BlcmEuY29tL2Vtb2xsZXIvYmxvZy8yMDExLzEyLzIwL3JlcXVlc3RhbmltYXRpb25mcmFtZS1mb3Itc21hcnQtZXItYW5pbWF0aW5nXHJcbiAgLy8gTUlUIGxpY2Vuc2VcclxuXHJcbiAgdmFyIHJlcXVlc3RBbmltYXRpb25GcmFtZSA9IHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnID8gd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSA6IG51bGw7XHJcbiAgdmFyIGNhbmNlbEFuaW1hdGlvbkZyYW1lID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgPyB3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUgOiBudWxsO1xyXG5cclxuICB2YXIgdmVuZG9ycyA9IFsnbXMnLCAnbW96JywgJ3dlYmtpdCcsICdvJ107XHJcbiAgZm9yKHZhciB4ID0gMDsgeCA8IHZlbmRvcnMubGVuZ3RoICYmICFyZXF1ZXN0QW5pbWF0aW9uRnJhbWU7ICsreCkge1xyXG4gICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gd2luZG93W3ZlbmRvcnNbeF0gKyAnUmVxdWVzdEFuaW1hdGlvbkZyYW1lJ107XHJcbiAgICBjYW5jZWxBbmltYXRpb25GcmFtZSA9IHdpbmRvd1t2ZW5kb3JzW3hdICsgJ0NhbmNlbEFuaW1hdGlvbkZyYW1lJ10gfHwgd2luZG93W3ZlbmRvcnNbeF0gKyAnQ2FuY2VsUmVxdWVzdEFuaW1hdGlvbkZyYW1lJ107XHJcbiAgfVxyXG5cclxuICBpZiAoIXJlcXVlc3RBbmltYXRpb25GcmFtZSkge1xyXG4gICAgdmFyIGxhc3RUaW1lID0gMDtcclxuICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZSA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XHJcbiAgICAgIHZhciBjdXJyVGltZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xyXG4gICAgICB2YXIgdGltZVRvQ2FsbCA9IE1hdGgubWF4KDAsIDE2IC0gKGN1cnJUaW1lIC0gbGFzdFRpbWUpKTtcclxuICAgICAgdmFyIGlkID0gc2V0VGltZW91dChmdW5jdGlvbigpIHsgY2FsbGJhY2soY3VyclRpbWUgKyB0aW1lVG9DYWxsKTsgfSwgdGltZVRvQ2FsbCk7XHJcbiAgICAgIGxhc3RUaW1lID0gY3VyclRpbWUgKyB0aW1lVG9DYWxsO1xyXG4gICAgICByZXR1cm4gaWQ7XHJcbiAgICB9O1xyXG5cclxuICAgIGNhbmNlbEFuaW1hdGlvbkZyYW1lID0gZnVuY3Rpb24oaWQpIHtcclxuICAgICAgY2xlYXJUaW1lb3V0KGlkKTtcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICByZXR1cm4ge1xyXG4gICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lOiBmdW5jdGlvbihjYWxsYmFjaykgeyByZXR1cm4gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGNhbGxiYWNrKTsgfSxcclxuICAgIGNhbmNlbEFuaW1hdGlvbkZyYW1lOiBmdW5jdGlvbihyZXF1ZXN0SUQpIHsgcmV0dXJuIGNhbmNlbEFuaW1hdGlvbkZyYW1lKHJlcXVlc3RJRCk7IH1cclxuICB9O1xyXG59KSgpO1xyXG5cclxuXHJcbmZ1bmN0aW9uIGdldENhbnZhcygpIHtcclxuICAvLyBUT0RPOiBFeHRyYWN0IHRoaXMgb3V0IHRvIGJyZWFrIGRlcGVuZGVuY3lcclxuICBpZiAodHlwZW9mIHdpbmRvdyA9PT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IGdldCBjYW52YXMgb3V0c2lkZSBvZiBicm93c2VyIGNvbnRleHQuJyk7XHJcbiAgfVxyXG5cclxuICAvLyBUT0RPOiBSZWFkIHRoZSBwcm9qZWN0IHNldHRpbmdzIHVzZSB0aGUgcmlnaHQgSURcclxuICB2YXIgY2FudmFzID0gd2luZG93LmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnZXNzby10YXJnZXQnKTtcclxuXHJcbiAgaWYgKCFjYW52YXMpIHtcclxuICAgIHZhciBjYW52YXNlcyA9IHdpbmRvdy5kb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnY2FudmFzJyk7XHJcbiAgICBpZiAoY2FudmFzZXMubGVuZ3RoID09PSAxKSB7XHJcbiAgICAgIGNhbnZhcyA9IGNhbnZhc2VzWzBdO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgaWYgKCFjYW52YXMpIHtcclxuICAgIHRocm93IG5ldyBFcnJvcignQ2FudmFzIG5vdCBmb3VuZC4nKTtcclxuICB9XHJcblxyXG4gIHJldHVybiBjYW52YXM7XHJcbn1cclxuXHJcblxyXG5mdW5jdGlvbiBnZXRDb250ZXh0MkQoKSB7XHJcbiAgcmV0dXJuIGdldENhbnZhcygpLmdldENvbnRleHQoJzJkJyk7XHJcbn1cclxuXHJcblxyXG5mdW5jdGlvbiBnZXRXZWJHTENvbnRleHQoKSB7XHJcbiAgcmV0dXJuIGdldENhbnZhcygpLmdldENvbnRleHQoJ3dlYmdsJyk7XHJcbn1cclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICByZXF1ZXN0QW5pbWF0aW9uRnJhbWU6IHJhZi5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUsXHJcbiAgY2FuY2VsQW5pbWF0aW9uRnJhbWU6IHJhZi5jYW5jZWxBbmltYXRpb25GcmFtZSxcclxuICBnZXRDYW52YXM6IGdldENhbnZhcyxcclxuICBnZXRDb250ZXh0MkQ6IGdldENvbnRleHQyRCxcclxuICBnZXRXZWJHTENvbnRleHQ6IGdldFdlYkdMQ29udGV4dFxyXG59O1xyXG4iLCJmdW5jdGlvbiBmb3JFYWNoKGFycmF5LCBzdGVwRnVuY3Rpb24pIHtcclxuICBmb3IgKHZhciBpbmRleCA9IDA7IGluZGV4IDwgYXJyYXkubGVuZ3RoOyBpbmRleCsrKSB7XHJcbiAgICBzdGVwRnVuY3Rpb24oYXJyYXlbaW5kZXhdKTtcclxuICB9XHJcbn1cclxuXHJcblxyXG5mdW5jdGlvbiBwb3AoYXJyYXksIGluZGV4KSB7XHJcbiAgcmV0dXJuIHR5cGVvZiBpbmRleCA9PT0gJ3VuZGVmaW5lZCcgPyBhcnJheS5wb3AoKSA6IGFycmF5LnNwbGljZShpbmRleCwgMSlbMF07XHJcbn1cclxuXHJcblxyXG5mdW5jdGlvbiBpbmRleE9mKGFycmF5LCBpdGVtLCBzdGFydEluZGV4KSB7XHJcbiAgZm9yICh2YXIgaW5kZXggPSBzdGFydEluZGV4IHx8IDA7IGluZGV4IDwgYXJyYXkubGVuZ3RoOyBpbmRleCsrKSB7XHJcbiAgICBpZiAoYXJyYXlbaW5kZXhdID09PSBpdGVtKSB7XHJcbiAgICAgIHJldHVybiBpbmRleDtcclxuICAgIH1cclxuICB9XHJcbiAgcmV0dXJuIC0xO1xyXG59XHJcblxyXG5cclxuZnVuY3Rpb24gbGFzdEluZGV4T2YoYXJyYXksIGl0ZW0sIHN0YXJ0SW5kZXgpIHtcclxuICBmb3IgKHZhciBpbmRleCA9IHN0YXJ0SW5kZXggfHwgYXJyYXkubGVuZ3RoIC0gMTsgaW5kZXggPj0gMDsgaW5kZXgtLSkge1xyXG4gICAgaWYgKGFycmF5W2luZGV4XSA9PT0gaXRlbSkge1xyXG4gICAgICByZXR1cm4gaW5kZXg7XHJcbiAgICB9XHJcbiAgfVxyXG4gIHJldHVybiAtMTtcclxufVxyXG5cclxuXHJcbmZ1bmN0aW9uIHJlbW92ZShhcnJheSwgaXRlbSkge1xyXG4gIHZhciBpbmRleCA9IGluZGV4T2YoYXJyYXksIGl0ZW0pO1xyXG4gIHJldHVybiBpbmRleCAhPT0gLTEgPyBwb3AoYXJyYXksIGluZGV4KSA6IG51bGw7XHJcbn1cclxuXHJcblxyXG5mdW5jdGlvbiByZW1vdmVMYXN0KGFycmF5LCBpdGVtKSB7XHJcbiAgdmFyIGluZGV4ID0gbGFzdEluZGV4T2YoYXJyYXksIGl0ZW0pO1xyXG4gIHJldHVybiBpbmRleCAhPT0gLTEgPyBwb3AoYXJyYXksIGluZGV4KSA6IG51bGw7XHJcbn1cclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICBmb3JFYWNoOiBmb3JFYWNoLFxyXG4gIHBvcDogcG9wLFxyXG4gIGluZGV4T2Y6IGluZGV4T2YsXHJcbiAgbGFzdEluZGV4T2Y6IGxhc3RJbmRleE9mLFxyXG4gIHJlbW92ZTogcmVtb3ZlLFxyXG4gIHJlbW92ZUxhc3Q6IHJlbW92ZUxhc3RcclxufTtcclxuIiwiLy8gR2Vzc28gRW50cnkgUG9pbnRcclxuLy8gRGV0ZWN0IHdoZXRoZXIgdGhpcyBpcyBjYWxsZWQgZnJvbSB0aGUgYnJvd3Nlciwgb3IgZnJvbSB0aGUgQ0xJLlxyXG5cclxuXHJcbmlmICh0eXBlb2Ygd2luZG93ID09PSAndW5kZWZpbmVkJykge1xyXG4gIC8vIFVzZSBtb2R1bGUucmVxdWlyZSBzbyB0aGUgY2xpZW50LXNpZGUgYnVpbGQgc2tpcHMgb3ZlciBzZXJ2ZXIgY29kZSxcclxuICAvLyB3aGljaCB3aWxsIHdvcmsgcHJvcGVybHkgYXQgcnVudGltZSBzaW5jZSBubyB3aW5kb3cgZ2xvYmFsIGlzIGRlZmluZWRcclxuICBtb2R1bGUuZXhwb3J0cyA9IG1vZHVsZS5yZXF1aXJlKCcuL2dlc3NvJyk7XHJcbn0gZWxzZSB7XHJcbiAgLy8gSW5jbHVkZSBpbiBjbGllbnQtc2lkZSBidWlsZCxcclxuICAvLyB3aGljaCB3aWxsIGhhdmUgYSB3aW5kb3cgZ2xvYmFsIGRlZmluZWQgYXQgcnVudGltZVxyXG4gIG1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9jbGllbnQnKTtcclxufVxyXG4iXX0=
