import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/**
 * AO без напівпрозорого й вирізаного за альфою: промінь маркера цілі, кільця, таблички знаків
 * у буфері нормалей були б суцільними прямокутниками й давали б плями та рамки.
 */
class SceneAO extends GTAOPass {
  /** викликається GTAOPass перед проходом нормалей і глибини (у типах three його немає) */
  overrideVisibility() {
    (GTAOPass.prototype as unknown as { overrideVisibility(this: GTAOPass): void }).overrideVisibility.call(this);
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m && !Array.isArray(m) && (m.transparent || m.alphaTest > 0)) o.visible = false;
    });
  }

  /** AO — м'яке й розмите, тож рахуємо його в половинній роздільності: учетверо дешевше, різниці майже не видно. */
  setSize(width: number, height: number) {
    super.setSize(Math.ceil(width / 2), Math.ceil(height / 2));
  }
}

/** Погода для обробки кадру. */
export type PostLook = 'clear' | 'fog' | 'night' | 'snow';

/**
 * Графіка «Ультра» (ПК): кадр малюється в буфер з MSAA ×4, далі —
 * GTAO (м'які контактні тіні під машинами, біля стін і бордюрів), уночі — світіння ліхтарів і фар,
 * і перетворення в sRGB. Тон-маппінгу немає: кольори ті самі, що й без обробки.
 */
export class PostFX {
  private composer: EffectComposer;
  private ao: SceneAO;
  private bloom: UnrealBloomPass;
  private size = new THREE.Vector2();

  constructor(private renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    renderer.getDrawingBufferSize(this.size);
    const target = new THREE.WebGLRenderTarget(this.size.x, this.size.y, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));
    // радіус — у метрах сцени: камера висить на 30 м, тож тінь має «стікати» з будинку на тротуар на кілька метрів
    this.ao = new SceneAO(scene, camera, Math.ceil(this.size.x / 2), Math.ceil(this.size.y / 2));
    this.ao.updateGtaoMaterial({ radius: 10, distanceExponent: 1, thickness: 10, scale: 1.6, samples: 16 });
    this.composer.addPass(this.ao);
    // світіння — лише вночі (вдень яскраві сніг і пісок «розпливалися» б)
    this.bloom = new UnrealBloomPass(this.size.clone(), 0.75, 0.55, 0.6);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.setLook('clear');
  }

  /** Під розмір вікна й pixel ratio рендерера. */
  resize() {
    const r = this.renderer;
    const s = r.getSize(this.size);
    this.composer.setPixelRatio(r.getPixelRatio());
    this.composer.setSize(s.x, s.y);
  }

  setLook(w: PostLook) {
    // у тумані й уночі AO слабше: далечінь і так розмита, а темні кути в тумані виглядали б брудно
    this.ao.blendIntensity = { clear: 1, snow: 0.85, fog: 0.45, night: 0.6 }[w];
    this.bloom.enabled = w === 'night';
  }

  render() {
    this.composer.render();
  }

  dispose() {
    this.composer.dispose();
    this.ao.dispose();
    this.bloom.dispose();
  }
}
