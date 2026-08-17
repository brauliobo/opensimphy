use nphysics2d::force_generator::DefaultForceGeneratorSet;
use nphysics2d::joint::DefaultJointConstraintSet;
use nphysics2d::nalgebra::Vector2;
use nphysics2d::ncollide2d::shape::{Ball, Cuboid, ShapeHandle};
use nphysics2d::object::{
    BodyPartHandle, ColliderDesc, DefaultBodyHandle, DefaultBodySet, DefaultColliderSet, Ground,
    RigidBodyDesc,
};
use nphysics2d::world::{DefaultGeometricalWorld, DefaultMechanicalWorld};
use wasm_bindgen::prelude::*;

const MAX_STEPS_PER_CALL: u32 = 600;
const MAX_TOTAL_STEPS: u32 = 6000;

#[wasm_bindgen]
pub struct World2d {
    mechanical_world: DefaultMechanicalWorld<f32>,
    geometrical_world: DefaultGeometricalWorld<f32>,
    bodies: DefaultBodySet<f32>,
    colliders: DefaultColliderSet<f32>,
    joint_constraints: DefaultJointConstraintSet<f32>,
    force_generators: DefaultForceGeneratorSet<f32>,
    body_handle: DefaultBodyHandle,
    steps: u32,
}

#[wasm_bindgen]
impl World2d {
    #[wasm_bindgen(constructor)]
    pub fn new() -> World2d {
        let mechanical_world = DefaultMechanicalWorld::new(Vector2::new(0.0, -9.81));
        let geometrical_world = DefaultGeometricalWorld::new();
        let mut bodies = DefaultBodySet::new();
        let mut colliders = DefaultColliderSet::new();

        let ground_handle = bodies.insert(Ground::new());
        let ground_shape = ShapeHandle::new(Cuboid::new(Vector2::new(5.0, 0.1)));
        colliders.insert(
            ColliderDesc::new(ground_shape)
                .translation(Vector2::new(0.0, -1.0))
                .build(BodyPartHandle(ground_handle, 0)),
        );

        let body_handle = bodies.insert(
            RigidBodyDesc::new()
                .translation(Vector2::new(0.0, 2.0))
                .build(),
        );
        let body_shape = ShapeHandle::new(Ball::new(0.25));
        colliders.insert(
            ColliderDesc::new(body_shape)
                .density(1.0)
                .build(BodyPartHandle(body_handle, 0)),
        );

        World2d {
            mechanical_world,
            geometrical_world,
            bodies,
            colliders,
            joint_constraints: DefaultJointConstraintSet::new(),
            force_generators: DefaultForceGeneratorSet::new(),
            body_handle,
            steps: 0,
        }
    }

    pub fn step(&mut self, steps: u32) -> Result<f32, JsValue> {
        if steps > MAX_STEPS_PER_CALL {
            return Err(JsValue::from_str("steps exceeds 600"));
        }
        let next_steps = self
            .steps
            .checked_add(steps)
            .ok_or_else(|| JsValue::from_str("total steps overflow"))?;
        if next_steps > MAX_TOTAL_STEPS {
            return Err(JsValue::from_str("total steps exceeds 6000"));
        }

        for _ in 0..steps {
            self.mechanical_world.step(
                &mut self.geometrical_world,
                &mut self.bodies,
                &mut self.colliders,
                &mut self.joint_constraints,
                &mut self.force_generators,
            );
        }
        self.steps = next_steps;
        Ok(self.body_y())
    }

    pub fn snapshot(&self) -> Vec<f32> {
        let body = self
            .bodies
            .rigid_body(self.body_handle)
            .expect("probe body must remain present");
        let position = body.position();
        vec![
            position.translation.vector.x,
            position.translation.vector.y,
            position.rotation.angle(),
            self.steps as f32,
        ]
    }
}

impl World2d {
    fn body_y(&self) -> f32 {
        self.bodies
            .rigid_body(self.body_handle)
            .expect("probe body must remain present")
            .position()
            .translation
            .vector
            .y
    }
}
