import * as THREE from 'three'

// 格式化数字显示
export function formatNumber(value: number, isShowPoint?: boolean): string {
  if (isShowPoint === undefined) {
    isShowPoint = Math.abs(value) >= 100
  }

  if (Math.abs(value) < 0.01 && value !== 0) {
    return value.toExponential(2)
  }

  if (isShowPoint) {
    return Math.floor(value).toString()
  } else {
    return value.toFixed(2)
  }
}

// UV 映射核心函数
function _applyBoxUV(geom: THREE.BufferGeometry, transformMatrix: THREE.Matrix4, bbox: THREE.Box3, bbox_max_size: number) {
  const coords: number[] = [];
  const positionAttr = geom.attributes.position;
  if (!positionAttr) {
    return;
  }
  coords.length = (2 * positionAttr.array.length) / 3;

  if (geom.attributes.uv === undefined) {
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(coords, 2));
  }

  const makeUVs = function (v0: THREE.Vector3, v1: THREE.Vector3, v2: THREE.Vector3) {
    v0.applyMatrix4(transformMatrix);
    v1.applyMatrix4(transformMatrix);
    v2.applyMatrix4(transformMatrix);

    const n = new THREE.Vector3();
    n.crossVectors(v1.clone().sub(v0), v1.clone().sub(v2)).normalize();
    n.x = Math.abs(n.x);
    n.y = Math.abs(n.y);
    n.z = Math.abs(n.z);

    const uv0 = new THREE.Vector2();
    const uv1 = new THREE.Vector2();
    const uv2 = new THREE.Vector2();

    if (n.y > n.x && n.y > n.z) {
      uv0.x = (v0.x - bbox.min.x) / bbox_max_size;
      uv0.y = (bbox.max.z - v0.z) / bbox_max_size;
      uv1.x = (v1.x - bbox.min.x) / bbox_max_size;
      uv1.y = (bbox.max.z - v1.z) / bbox_max_size;
      uv2.x = (v2.x - bbox.min.x) / bbox_max_size;
      uv2.y = (bbox.max.z - v2.z) / bbox_max_size;
    } else if (n.x > n.y && n.x > n.z) {
      uv0.x = (v0.z - bbox.min.z) / bbox_max_size;
      uv0.y = (v0.y - bbox.min.y) / bbox_max_size;
      uv1.x = (v1.z - bbox.min.z) / bbox_max_size;
      uv1.y = (v1.y - bbox.min.y) / bbox_max_size;
      uv2.x = (v2.z - bbox.min.z) / bbox_max_size;
      uv2.y = (v2.y - bbox.min.y) / bbox_max_size;
    } else if (n.z > n.y && n.z > n.x) {
      uv0.x = (v0.x - bbox.min.x) / bbox_max_size;
      uv0.y = (v0.y - bbox.min.y) / bbox_max_size;
      uv1.x = (v1.x - bbox.min.x) / bbox_max_size;
      uv1.y = (v1.y - bbox.min.y) / bbox_max_size;
      uv2.x = (v2.x - bbox.min.x) / bbox_max_size;
      uv2.y = (v2.y - bbox.min.y) / bbox_max_size;
    }

    return { uv0: uv0, uv1: uv1, uv2: uv2 };
  };

  if (geom.index && positionAttr) {
    for (let vi = 0; vi < geom.index.array.length; vi += 3) {
      const idx0 = geom.index.array[vi] ?? 0;
      const idx1 = geom.index.array[vi + 1] ?? 0;
      const idx2 = geom.index.array[vi + 2] ?? 0;

      const vx0 = positionAttr.array[3 * idx0] ?? 0;
      const vy0 = positionAttr.array[3 * idx0 + 1] ?? 0;
      const vz0 = positionAttr.array[3 * idx0 + 2] ?? 0;

      const vx1 = positionAttr.array[3 * idx1] ?? 0;
      const vy1 = positionAttr.array[3 * idx1 + 1] ?? 0;
      const vz1 = positionAttr.array[3 * idx1 + 2] ?? 0;

      const vx2 = positionAttr.array[3 * idx2] ?? 0;
      const vy2 = positionAttr.array[3 * idx2 + 1] ?? 0;
      const vz2 = positionAttr.array[3 * idx2 + 2] ?? 0;

      const v0 = new THREE.Vector3(vx0, vy0, vz0);
      const v1 = new THREE.Vector3(vx1, vy1, vz1);
      const v2 = new THREE.Vector3(vx2, vy2, vz2);

      const uvs = makeUVs(v0, v1, v2);

      coords[2 * idx0] = uvs.uv0.x;
      coords[2 * idx0 + 1] = uvs.uv0.y;
      coords[2 * idx1] = uvs.uv1.x;
      coords[2 * idx1 + 1] = uvs.uv1.y;
      coords[2 * idx2] = uvs.uv2.x;
      coords[2 * idx2 + 1] = uvs.uv2.y;
    }
  }

  const uvAttr = geom.attributes.uv;
  if (uvAttr) {
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(coords, 2));
  }
}

// 应用 Box UV 映射
export function applyBoxUV(bufferGeometry: THREE.BufferGeometry, transformMatrix: THREE.Matrix4 | undefined = undefined, boxSize: number | undefined = undefined) {
  if (transformMatrix === undefined) {
    transformMatrix = new THREE.Matrix4();
  }

  if (boxSize === undefined) {
    const geom = bufferGeometry;
    geom.computeBoundingBox();
    const bbox = geom.boundingBox;

    if (!bbox) {
      return;
    }

    const bbox_size_x = bbox.max.x - bbox.min.x;
    const bbox_size_z = bbox.max.z - bbox.min.z;
    const bbox_size_y = bbox.max.y - bbox.min.y;

    boxSize = Math.max(bbox_size_x, bbox_size_y, bbox_size_z);
  }

  const uvBbox = new THREE.Box3(
    new THREE.Vector3(-boxSize / 2, -boxSize / 2, -boxSize / 2),
    new THREE.Vector3(boxSize / 2, boxSize / 2, boxSize / 2)
  );

  _applyBoxUV(bufferGeometry, transformMatrix, uvBbox, boxSize);
}

