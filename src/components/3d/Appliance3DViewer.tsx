import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export interface Appliance3DViewerProps {
  type?: 'fridge' | 'washer' | 'espresso' | 'robot';
  autoRotate?: boolean;
}

export const Appliance3DViewer: React.FC<Appliance3DViewerProps> = ({
  type = 'fridge',
  autoRotate = true,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 400;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0.05, 4.4);

    // 2. WebGL Renderer với Tone Mapping & Bóng đổ mềm
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);

    // 3. Hệ thống đèn Studio cao cấp (Sáng rõ, nổi bật trên nền tối)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.6);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
    keyLight.position.set(3, 4, 3);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0003;
    scene.add(keyLight);

    const frontFill = new THREE.DirectionalLight(0xf1f5f9, 1.4);
    frontFill.position.set(0, 1.5, 4);
    scene.add(frontFill);

    const rimLight = new THREE.PointLight(0xf43f5e, 3.5, 8); // Ánh viền hồng Rose của SecondLife
    rimLight.position.set(-3, 1, -2);
    scene.add(rimLight);

    // 4. Bệ Studio & Đổ bóng tiếp xúc (Soft Contact Shadow)
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // Tạo chất liệu bóng đổ tròn Gaussian mềm mịn
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 256;
    shadowCanvas.height = 256;
    const sCtx = shadowCanvas.getContext('2d')!;
    const grad = sCtx.createRadialGradient(128, 128, 10, 128, 128, 120);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
    grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.35)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 256, 256);

    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowGeo = new THREE.PlaneGeometry(3.2, 3.2);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMesh = new THREE.Mesh(
      shadowGeo,
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.8, depthWrite: false })
    );
    shadowMesh.position.y = -1.05;
    rootGroup.add(shadowMesh);

    // Đĩa bệ tròn Studio viền kim loại
    const pedestalGeo = new THREE.CylinderGeometry(1.5, 1.55, 0.04, 64);
    const pedestalMat = new THREE.MeshStandardMaterial({ color: 0x141822, metalness: 0.8, roughness: 0.2 });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = -1.07;
    pedestal.receiveShadow = true;
    rootGroup.add(pedestal);

    // 5. Dựng hình thiết bị (Màu Titanium Platinum Silver sáng rõ)
    const applianceGroup = new THREE.Group();
    applianceGroup.position.y = 0.05;
    rootGroup.add(applianceGroup);

    if (type === 'fridge') {
      // Tủ lạnh Titanium Silver
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd8dee9, metalness: 0.85, roughness: 0.22 });
      const doorMat = new THREE.MeshPhysicalMaterial({ color: 0xe5e9f0, metalness: 0.88, roughness: 0.18, clearcoat: 0.6 });
      const handleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.98, roughness: 0.08 });

      // Thân tủ
      const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.35, 2.05, 0.95), bodyMat);
      cabinet.castShadow = true;
      applianceGroup.add(cabinet);

      // Cánh cửa trái & phải
      const leftDoor = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.95, 0.06), doorMat);
      leftDoor.position.set(-0.34, 0, 0.5);
      leftDoor.castShadow = true;
      applianceGroup.add(leftDoor);

      const rightDoor = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.95, 0.06), doorMat);
      rightDoor.position.set(0.34, 0, 0.5);
      rightDoor.castShadow = true;
      applianceGroup.add(rightDoor);

      // Tay nắm cửa kim loại
      const handleL = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.8, 16), handleMat);
      handleL.position.set(-0.06, 0, 0.56);
      applianceGroup.add(handleL);

      const handleR = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.8, 16), handleMat);
      handleR.position.set(0.06, 0, 0.56);
      applianceGroup.add(handleR);

      // Màn hình LED cảm ứng & vòi nước
      const dispenser = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.4, 0.02),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.2, metalness: 0.8 })
      );
      dispenser.position.set(-0.34, 0.2, 0.54);
      applianceGroup.add(dispenser);

      const led = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.04, 0.01),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 2.0 })
      );
      led.position.set(-0.34, 0.3, 0.555);
      applianceGroup.add(led);
    } else if (type === 'washer') {
      // Máy giặt Pearl Platinum White
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.35, roughness: 0.2 });
      const chromeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.98, roughness: 0.08 });

      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.5, 1.2), bodyMat);
      frame.castShadow = true;
      applianceGroup.add(frame);

      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 16, 48), chromeMat);
      rim.position.set(0, -0.1, 0.62);
      applianceGroup.add(rim);

      const glass = new THREE.Mesh(
        new THREE.SphereGeometry(0.38, 32, 16, 0, Math.PI * 2, 0, Math.PI / 3.5),
        new THREE.MeshPhysicalMaterial({ color: 0x38bdf8, transmission: 0.65, transparent: true, roughness: 0.1 })
      );
      glass.position.set(0, -0.1, 0.6);
      applianceGroup.add(glass);
    }

    // 6. Xử lý tương tác kéo chuột xoay đa chiều & quán tính mượt mà
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    let targetRotation = { x: 0.1, y: 0.3 };
    let currentRotation = { x: 0.1, y: 0.3 };
    let targetZoom = 4.4;
    let currentZoom = 4.4;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouse.x;
      const deltaY = e.clientY - prevMouse.y;
      targetRotation.y += deltaX * 0.008;
      targetRotation.x = Math.max(-0.35, Math.min(0.45, targetRotation.x + deltaY * 0.006));
      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => (isDragging = false);

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      targetZoom = Math.max(2.8, Math.min(5.5, targetZoom + e.deltaY * 0.003));
    };

    const dom = renderer.domElement;
    dom.style.cursor = 'grab';
    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('wheel', onWheel, { passive: false });

    // 7. Render Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (autoRotate && !isDragging) {
        targetRotation.y += 0.005;
      }

      // Quán tính Damping
      currentRotation.x += (targetRotation.x - currentRotation.x) * 0.08;
      currentRotation.y += (targetRotation.y - currentRotation.y) * 0.08;
      currentZoom += (targetZoom - currentZoom) * 0.08;

      rootGroup.rotation.x = currentRotation.x;
      rootGroup.rotation.y = currentRotation.y;
      camera.position.z = currentZoom;

      renderer.render(scene, camera);
    };
    animate();

    // Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: nw, height: nh } = entry.contentRect;
        if (nw > 0 && nh > 0) {
          camera.aspect = nw / nh;
          camera.updateProjectionMatrix();
          renderer.setSize(nw, nh);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('wheel', onWheel);
      if (container.contains(dom)) container.removeChild(dom);
      renderer.dispose();
    };
  }, [type, autoRotate]);

  return <div ref={mountRef} className="w-full h-full min-h-[320px] flex items-center justify-center relative touch-none select-none" />;
};
