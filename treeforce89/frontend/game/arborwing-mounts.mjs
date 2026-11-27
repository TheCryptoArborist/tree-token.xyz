// Mounts are expressed in the logical 128x160 player frame, before stage scale.
// Match the upper gold surface of each reviewed glider, below the hero's feet/hands.
export function arborwingMount(scene){
 if(!scene.registry.get('seedlingHDReview'))return null;
 const stage=scene.stage;
 const layout=stage===0?scene.registry.get('seedlingArtLayout'):scene.registry.get('growthArtLayouts')?.[stage-1];
 if(!layout)return null;
 const front=[.868,.865,.865,.82,.82][stage];
 return {x:layout.width*.40,y:layout.y+layout.height*front-80};
}
