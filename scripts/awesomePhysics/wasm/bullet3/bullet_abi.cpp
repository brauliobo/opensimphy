#include "btBulletDynamicsCommon.h"

extern "C" int bullet_version() {
    return 327;
}

extern "C" float bullet_step() {
    auto* collision_configuration = new btDefaultCollisionConfiguration();
    auto* dispatcher = new btCollisionDispatcher(collision_configuration);
    auto* broadphase = new btDbvtBroadphase();
    auto* solver = new btSequentialImpulseConstraintSolver();
    auto* world = new btDiscreteDynamicsWorld(dispatcher, broadphase, solver, collision_configuration);
    world->setGravity(btVector3(0, -10, 0));

    auto* ground_shape = new btStaticPlaneShape(btVector3(0, 1, 0), 0);
    auto* ground = new btRigidBody(0, nullptr, ground_shape, btVector3(0, 0, 0));
    world->addRigidBody(ground);

    auto* sphere_shape = new btSphereShape(1);
    btVector3 sphere_inertia(0, 0, 0);
    sphere_shape->calculateLocalInertia(1, sphere_inertia);
    auto* motion_state = new btDefaultMotionState(btTransform(btQuaternion(0, 0, 0, 1), btVector3(0, 10, 0)));
    btRigidBody::btRigidBodyConstructionInfo sphere_info(1, motion_state, sphere_shape, sphere_inertia);
    auto* sphere = new btRigidBody(sphere_info);
    world->addRigidBody(sphere);

    world->stepSimulation(btScalar(1.0 / 60.0), 10);
    const float y = sphere->getWorldTransform().getOrigin().getY();

    world->removeRigidBody(sphere);
    delete sphere;
    delete motion_state;
    delete sphere_shape;
    world->removeRigidBody(ground);
    delete ground;
    delete ground_shape;
    delete world;
    delete solver;
    delete broadphase;
    delete dispatcher;
    delete collision_configuration;
    return y;
}
