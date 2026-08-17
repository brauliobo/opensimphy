#include "chipmunk/chipmunk.h"

#include <math.h>
#include <stddef.h>

#define PYMUNK_VERSION 730
#define PYMUNK_MAX_STEPS 600
#define PYMUNK_DT (1.0 / 60.0)
#define PYMUNK_GRAVITY_Y (-9.81)
#define PYMUNK_BALL_MASS 1.0
#define PYMUNK_BALL_RADIUS 0.5
#define PYMUNK_BALL_X 0.0
#define PYMUNK_BALL_Y 2.0

static int last_steps = -1;
static float last_x;
static float last_y;
static float last_angle;

static int simulate(int steps, float *x, float *y, float *angle) {
  if (steps < 0 || steps > PYMUNK_MAX_STEPS) return 0;

  cpSpace *space = cpSpaceNew();
  cpSpaceSetGravity(space, cpv(0, PYMUNK_GRAVITY_Y));

  cpShape *ground = cpSegmentShapeNew(cpSpaceGetStaticBody(space), cpv(-20, 0), cpv(20, 0), 0);
  cpShapeSetFriction(ground, 1);
  cpSpaceAddShape(space, ground);

  cpFloat moment = cpMomentForCircle(PYMUNK_BALL_MASS, 0, PYMUNK_BALL_RADIUS, cpvzero);
  cpBody *ball = cpSpaceAddBody(space, cpBodyNew(PYMUNK_BALL_MASS, moment));
  cpBodySetPosition(ball, cpv(PYMUNK_BALL_X, PYMUNK_BALL_Y));
  cpShape *circle = cpSpaceAddShape(space, cpCircleShapeNew(ball, PYMUNK_BALL_RADIUS, cpvzero));
  cpShapeSetFriction(circle, 0.7);

  for (int index = 0; index < steps; index += 1) cpSpaceStep(space, PYMUNK_DT);

  cpVect position = cpBodyGetPosition(ball);
  *x = (float)position.x;
  *y = (float)position.y;
  *angle = (float)cpBodyGetAngle(ball);

  cpSpaceRemoveShape(space, circle);
  cpSpaceRemoveBody(space, ball);
  cpSpaceRemoveShape(space, ground);
  cpShapeFree(circle);
  cpBodyFree(ball);
  cpShapeFree(ground);
  cpSpaceFree(space);
  return 1;
}

static int ensure(int steps) {
  if (last_steps == steps) return 1;
  if (!simulate(steps, &last_x, &last_y, &last_angle)) {
    last_steps = -1;
    last_x = NAN;
    last_y = NAN;
    last_angle = NAN;
    return 0;
  }
  last_steps = steps;
  return 1;
}

int pymunk_version(void) {
  return PYMUNK_VERSION;
}

float pymunk_step(int steps) {
  if (!ensure(steps)) return NAN;
  return last_y;
}

float pymunk_x(void) {
  return last_x;
}

float pymunk_angle(void) {
  return last_angle;
}

int pymunk_steps(void) {
  return last_steps;
}
