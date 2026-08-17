use ncollide2d::na::{Isometry2, Point2, Vector2};
use ncollide2d::query::{self, DefaultTOIDispatcher, Ray, RayCast};
use ncollide2d::shape::{Ball, Cuboid, Plane};

const MAX_STEPS: u32 = 600;
const DT: f32 = 1.0 / 60.0;
const GRAVITY: f32 = -9.81;
const BALL_RADIUS: f32 = 0.25;
const BALL_START_Y: f32 = 2.0;
const GROUND_HALF_X: f32 = 5.0;
const GROUND_HALF_Y: f32 = 0.1;
const GROUND_Y: f32 = -1.0;
const TOI_MAX: f32 = 10.0;

fn ball() -> Ball<f32> {
    Ball::new(BALL_RADIUS)
}

fn ground() -> Cuboid<f32> {
    Cuboid::new(Vector2::new(GROUND_HALF_X, GROUND_HALF_Y))
}

fn ball_pose(y: f32) -> Isometry2<f32> {
    Isometry2::translation(0.0, y)
}

fn ground_pose() -> Isometry2<f32> {
    Isometry2::translation(0.0, GROUND_Y)
}

fn moving_ball() -> Ball<f32> {
    Ball::new(BALL_RADIUS)
}

fn static_ball() -> Ball<f32> {
    Ball::new(BALL_RADIUS)
}

#[no_mangle]
pub extern "C" fn ncollide_distance() -> f32 {
    query::distance(&ball_pose(BALL_START_Y), &ball(), &ground_pose(), &ground())
}

#[no_mangle]
pub extern "C" fn ncollide_contact_depth() -> f32 {
    match query::contact(
        &ball_pose(BALL_START_Y),
        &ball(),
        &ground_pose(),
        &ground(),
        4.0,
    ) {
        Some(contact) => contact.depth,
        None => f32::NAN,
    }
}

#[no_mangle]
pub extern "C" fn ncollide_ray_toi() -> f32 {
    let ray = Ray::new(Point2::new(0.0, 4.0), Vector2::new(0.0, -1.0));
    ball()
        .toi_with_ray(&ball_pose(BALL_START_Y), &ray, TOI_MAX, true)
        .unwrap_or(f32::NAN)
}

#[no_mangle]
pub extern "C" fn ncollide_time_of_impact() -> f32 {
    match query::time_of_impact_ball_ball(
        &Point2::new(0.0, BALL_START_Y),
        &Vector2::new(0.0, -1.0),
        &moving_ball(),
        &Point2::new(0.0, 0.0),
        &Vector2::zeros(),
        &static_ball(),
        TOI_MAX,
        0.0,
    ) {
        Some(toi) => toi.toi,
        None => f32::NAN,
    }
}

#[no_mangle]
pub extern "C" fn ncollide_step(steps: u32) -> f32 {
    if steps > MAX_STEPS {
        return f32::NAN;
    }

    let mut y = BALL_START_Y;
    let mut vy = 0.0f32;
    let ball_shape = ball();
    let plane = Plane::new(Vector2::y_axis());
    let plane_m = ground_pose();
    let rest_y = GROUND_Y + BALL_RADIUS;

    for _ in 0..steps {
        vy += GRAVITY * DT;
        if vy >= 0.0 {
            y += vy * DT;
            continue;
        }
        let ball_m = ball_pose(y);
        match query::time_of_impact(
            &DefaultTOIDispatcher,
            &ball_m,
            &Vector2::new(0.0, vy),
            &ball_shape,
            &plane_m,
            &Vector2::zeros(),
            &plane,
            DT,
            0.0,
        ) {
            Ok(Some(toi)) if toi.toi <= DT => {
                y += vy * toi.toi;
                if y < rest_y {
                    y = rest_y;
                }
                vy = 0.0;
            }
            Ok(Some(_)) | Ok(None) | Err(_) => {
                y += vy * DT;
                if y < rest_y {
                    y = rest_y;
                    vy = 0.0;
                }
            }
        }
    }
    y
}
