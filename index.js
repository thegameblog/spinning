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
