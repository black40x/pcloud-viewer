// @flow

import {
  AmbientLight,
  Color,
  PerspectiveCamera,
  PointLight,
  Scene,
  WebGLRenderer,
} from 'three'

import {TrackballControls} from "three/examples/jsm/controls/TrackballControls"
import {PointCloud} from "./PointCloud"

type ViewerOptions = {
  viewport: Element
}

class Viewer {
  viewport: Element
  scene: Scene
  camera: PerspectiveCamera | OrthographicCamera
  renderer: WebGLRenderer
  controls: TrackballControls
  pointCloud: ?PointCloud

  constructor(options: ViewerOptions, onReady: ?Function = null) {
    this.viewport = options.viewport
    this._initViewer()
    this._initControls()

    if (onReady) {
      onReady(this)
    }

    this.animation()
  }

  _initViewer() {
    this.scene = new Scene()
    this.scene.background = new Color(0x000000)
    this.scene.add(new AmbientLight(0xfefefe))

    this.camera = new PerspectiveCamera(10, 1, 1, 3500)
    this.camera.position.set(0, 0, -170)
    this.camera.add(new PointLight(0xffffff, 1.0))
    this.camera.aspect = this.viewport.offsetWidth / this.viewport.offsetHeight
    this.camera.updateProjectionMatrix()

    this.renderer = new WebGLRenderer({ antialias: false, alpha: false })
    this.renderer.setClearColor(0x000000, 0.5)
    this.renderer.setSize(this.viewport.offsetWidth, this.viewport.offsetHeight)
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.autoClear = false

    this.viewport.appendChild(this.renderer.domElement)

    this.scene.add(this.camera)

    window.addEventListener('resize', () => {
      this.camera.aspect = this.viewport.offsetWidth / this.viewport.offsetHeight
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(this.viewport.offsetWidth, this.viewport.offsetHeight)
    })
  }

  _initControls() {
    this.controls = new TrackballControls(this.camera, this.renderer.domElement)
    this.controls.screenSpacePanning = false
    this.controls.rotateSpeed = 1.0
    this.controls.zoomSpeed = 1.2
    this.controls.panSpeed = 0.1
    this.controls.minDistance = 5
    this.controls.maxDistance = 1500

    this.controls.addEventListener('change', () => {
      // this.render()
    })
  }

  loadPointCloud(options: PointCloudOptions) {
    if (!this.pointCloud) {
      this.pointCloud = new PointCloud(options)
      this.pointCloud.init(this.scene, () => {})
    } else {
      throw new Error(`PointCloud already loaded`)
    }
  }

  animation() {
    requestAnimationFrame(this.animation.bind(this))
    this.controls.update()
    this.render()
  }

  render() {
    this.renderer.render(this.scene, this.camera)
    if (this.pointCloud && this.pointCloud.isInited()) {
      let result = this.pointCloud.getVisibleNodes(this.camera, this.renderer)

      //
      if (result.lowestSpacing !== Infinity) {
        let near = result.lowestSpacing * 10.0
        let far = -this.pointCloud.rootNode.boundingBox.applyMatrix4(this.camera.matrixWorldInverse).min.z

        far = Math.max(far * 1.5, 10000)
        near = Math.min(100.0, Math.max(0.01, near))
        far = Math.max(far, near + 10000)

        if (near === Infinity) {
          near = 0.1
        }

        this.camera.near = near
        this.camera.far = far
      }
      //

      Object.keys(this.pointCloud.nodes).forEach(key => {
        if (result.visibleNodes.includes(this.pointCloud.nodes[key])) {
          this.pointCloud.nodes[key].setVisibility(true)
        } else {
          this.pointCloud.nodes[key].setVisibility(false)
        }
      })

      result.visibleNodes.forEach(node => {
        if (!node.isLoaded()) {
          node.loadPoints()
        }
      })
    }
  }
}

export { Viewer }
