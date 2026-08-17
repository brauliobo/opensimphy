#include "PxPhysicsAPI.h"

using namespace physx;

extern "C" int physx_version() {
    return PX_PHYSICS_VERSION;
}

extern "C" float physx_step() {
    PxDefaultAllocator allocator;
    PxDefaultErrorCallback errors;
    PxFoundation* foundation = PxCreateFoundation(PX_FOUNDATION_VERSION, allocator, errors);
    PxPhysics* physics = PxCreatePhysics(PX_PHYSICS_VERSION, *foundation, PxTolerancesScale(), false, nullptr);

    PxSceneDesc sceneDesc(physics->getTolerancesScale());
    sceneDesc.gravity = PxVec3(0.0f, -10.0f, 0.0f);
    PxDefaultCpuDispatcher* dispatcher = PxDefaultCpuDispatcherCreate(0);
    sceneDesc.cpuDispatcher = dispatcher;
    sceneDesc.filterShader = PxDefaultSimulationFilterShader;
    PxScene* scene = physics->createScene(sceneDesc);

    PxMaterial* material = physics->createMaterial(0.5f, 0.5f, 0.0f);
    PxRigidStatic* ground = PxCreatePlane(*physics, PxPlane(0.0f, 1.0f, 0.0f, 0.0f), *material);
    scene->addActor(*ground);

    PxRigidDynamic* sphere = PxCreateDynamic(
        *physics,
        PxTransform(PxVec3(0.0f, 10.0f, 0.0f)),
        PxSphereGeometry(1.0f),
        *material,
        1.0f);
    scene->addActor(*sphere);

    scene->simulate(1.0f / 60.0f);
    scene->fetchResults(true);
    const float y = sphere->getGlobalPose().p.y;

    scene->release();
    dispatcher->release();
    physics->release();
    foundation->release();
    return y;
}
