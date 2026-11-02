<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import MarkdownRenderer from './components/MarkdownRenderer.vue';

interface DocItem { name: string; title: string; path: string; }
interface Photon { id: number; x: number; y: number; size: number; delay: number; duration: number; hue: number; }

const base = import.meta.env.BASE_URL;
const docs: DocItem[] = [
  { name: 'index',      title: '系统概述', path: `${base}docs/index.md` },
  { name: 'features',   title: '功能特性', path: `${base}docs/features.md` },
  { name: 'tech-stack', title: '技术栈',   path: `${base}docs/tech-stack.md` }
];

const currentDoc = ref(docs[0]);
const markdownContent = ref('');
const isLoading = ref(true);
const mouseX = ref(0);
const mouseY = ref(0);
const photons = ref<Photon[]>([]);
const sparks = ref<{ id: number; x: number; y: number; dx: number; dy: number; hue: number }[]>([]);

const loadMarkdown = async (doc: DocItem) => {
  isLoading.value = true;
  currentDoc.value = doc;
  try {
    const res = await fetch(doc.path, { cache: 'no-store' });
    markdownContent.value = await res.text();
  } catch (e) {
    console.error(e);
    markdownContent.value = '# 加载失败\n\n无法加载文档内容，请检查文件路径是否正确。';
  } finally {
    isLoading.value = false;
  }
};

const initPhotons = () => {
  const arr: Photon[] = [];
  for (let i = 0; i < 80; i++) {
    arr.push({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      delay: Math.random() * 6,
      duration: 2 + Math.random() * 4,
      hue: 180 + Math.random() * 80
    });
  }
  photons.value = arr;
};

let sparkId = 0;
const onMouseMove = (e: MouseEvent) => {
  mouseX.value = e.clientX;
  mouseY.value = e.clientY;
  if (Math.random() < 0.4) {
    sparks.value.push({
      id: ++sparkId,
      x: e.clientX,
      y: e.clientY,
      dx: (Math.random() - 0.5) * 2,
      dy: (Math.random() - 0.5) * 2,
      hue: 180 + Math.random() * 80
    });
  }
  if (sparks.value.length > 30) sparks.value.splice(0, sparks.value.length - 30);
};

const cleanupSparks = setInterval(() => {
  if (sparks.value.length > 0) sparks.value.shift();
}, 200);

onMounted(() => {
  loadMarkdown(currentDoc.value);
  initPhotons();
  window.addEventListener('mousemove', onMouseMove, { passive: true });
});

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onMouseMove);
  clearInterval(cleanupSparks);
});
</script>

<template>
  <div class="app-container">
    <div class="photon-bg">
      <div class="grid-bg"></div>
      <div class="glow-orb glow-orb-1"></div>
      <div class="glow-orb glow-orb-2"></div>
      <div class="glow-orb glow-orb-3"></div>
      <div
        v-for="p in photons" :key="p.id" class="photon"
        :style="{ left: p.x + '%', top: p.y + '%', width: p.size + 'px', height: p.size + 'px', animationDelay: p.delay + 's', animationDuration: p.duration + 's', background: `hsl(${p.hue}, 100%, 70%)`, boxShadow: `0 0 ${p.size * 3}px hsl(${p.hue}, 100%, 70%)` }"
      ></div>
    </div>

    <div class="cursor-glow" :style="{ left: mouseX + 'px', top: mouseY + 'px' }"></div>
    <div class="cursor-ring" :style="{ left: mouseX + 'px', top: mouseY + 'px' }"></div>
    <div
      v-for="s in sparks" :key="s.id" class="spark"
      :style="{ left: s.x + 'px', top: s.y + 'px', '--dx': s.dx + 'px', '--dy': s.dy + 'px', background: `hsl(${s.hue}, 100%, 75%)`, boxShadow: `0 0 6px hsl(${s.hue}, 100%, 70%)` }"
    ></div>

    <header class="header">
      <div class="scan-line"></div>
      <div class="logo">
        <div class="tech-badge"><span class="dot"></span> YMS · ONLINE</div>
        <h1><span class="glitch" data-text="YMS">YMS</span><span class="title-sub"> 良率管理系统</span></h1>
        <p class="subtitle">FAB厂良率数据全生命周期分析与管理平台</p>
        <div class="header-stats">
          <div class="stat"><div class="stat-val">99.8%</div><div class="stat-label">系统可用性</div></div>
          <div class="stat"><div class="stat-val">ms</div><div class="stat-label">级实时响应</div></div>
          <div class="stat"><div class="stat-val">PB</div><div class="stat-label">级数据处理</div></div>
        </div>
      </div>
    </header>

    <nav class="sidebar">
      <div class="nav-title">▣ 文档导航</div>
      <ul class="nav-list">
        <li v-for="doc in docs" :key="doc.name" :class="{ active: currentDoc.name === doc.name }" @click="loadMarkdown(doc)">
          <span class="nav-arrow">▸</span>{{ doc.title }}
        </li>
      </ul>
      <div class="nav-footer">
        <div class="version">v1.0.0</div>
        <div class="status-dot"></div>
      </div>
    </nav>

    <main class="main-content">
      <div v-if="isLoading" class="loading">
        <div class="tech-spinner"><div class="ring ring-1"></div><div class="ring ring-2"></div><div class="ring ring-3"></div></div>
        <p class="loading-text">INITIALIZING DATA MODULE...</p>
      </div>
      <div class="content-panel" v-else><MarkdownRenderer :content="markdownContent" /></div>
    </main>

    <footer class="footer">
      <div class="footer-inner">
        <span>&copy; 2026 YMS 良率管理系统</span>
        <span class="footer-dot">●</span>
        <span class="footer-tag">POWERED BY SEMICONDUCTOR TECH</span>
        <span class="footer-dot">●</span>
        <span class="footer-time">SYSTEM NOMINAL</span>
      </div>
    </footer>
  </div>
</template>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
:root {
  --tech-bg: #050816; --tech-blue: #00d4ff; --tech-cyan: #22f7c9; --tech-purple: #7c5cff;
  --tech-border: rgba(0, 212, 255, 0.15);
}
html, body { font-family: 'SF Mono', 'Consolas', 'Menlo', 'PingFang SC', 'Microsoft YaHei', monospace, sans-serif; background: var(--tech-bg); color: #cfe8ff; overflow-x: hidden; cursor: none; }
* { cursor: none !important; }
.app-container { position: relative; display: flex; flex-direction: column; min-height: 100vh; z-index: 1; }

.photon-bg { position: fixed; inset: 0; pointer-events: none; overflow: hidden; z-index: 0; background: radial-gradient(ellipse at 20% 10%, rgba(124,92,255,.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(0,212,255,.1) 0%, transparent 50%), var(--tech-bg); }
.grid-bg { position: absolute; inset: 0; background-image: linear-gradient(rgba(0,212,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,.06) 1px, transparent 1px); background-size: 50px 50px; mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%); -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%); }
.glow-orb { position: absolute; border-radius: 50%; filter: blur(80px); opacity: .5; animation: floatOrb 15s ease-in-out infinite; }
.glow-orb-1 { width: 500px; height: 500px; background: var(--tech-purple); top: -10%; left: -10%; }
.glow-orb-2 { width: 400px; height: 400px; background: var(--tech-blue); bottom: -20%; right: -10%; animation-delay: -5s; animation-duration: 18s; }
.glow-orb-3 { width: 300px; height: 300px; background: var(--tech-cyan); top: 50%; left: 60%; animation-delay: -8s; animation-duration: 20s; }
@keyframes floatOrb { 0%,100%{transform:translate(0,0) scale(1);} 33%{transform:translate(40px,-30px) scale(1.1);} 66%{transform:translate(-30px,40px) scale(.95);} }
.photon { position: absolute; border-radius: 50%; animation: photonBlink ease-in-out infinite; pointer-events: none; }
@keyframes photonBlink { 0%,100%{opacity:0;transform:scale(.3);} 30%{opacity:1;transform:scale(1);} 70%{opacity:.6;transform:scale(.8);} }

.cursor-glow { position: fixed; width: 500px; height: 500px; border-radius: 50%; background: radial-gradient(circle, rgba(0,212,255,.12) 0%, rgba(124,92,255,.06) 30%, transparent 60%); pointer-events: none; z-index: 9998; transform: translate(-50%, -50%); mix-blend-mode: screen; }
.cursor-ring { position: fixed; width: 24px; height: 24px; border: 2px solid var(--tech-blue); border-radius: 50%; pointer-events: none; z-index: 9999; transform: translate(-50%, -50%); box-shadow: 0 0 15px var(--tech-blue), inset 0 0 8px rgba(0,212,255,.5); animation: cursorPulse 2s ease-in-out infinite; }
@keyframes cursorPulse { 0%,100%{border-color:var(--tech-blue);} 50%{border-color:var(--tech-cyan);box-shadow:0 0 20px var(--tech-cyan),inset 0 0 12px rgba(34,247,201,.6);} }
.spark { position: fixed; width: 5px; height: 5px; border-radius: 50%; pointer-events: none; z-index: 9997; animation: sparkFly .8s ease-out forwards; }
@keyframes sparkFly { 0%{opacity:1;transform:translate(-50%,-50%) scale(1);} 100%{opacity:0;transform:translate(calc(-50% + var(--dx) * 40), calc(-50% + var(--dy) * 40 - 20px)) scale(0);} }

.header { position: relative; overflow: hidden; background: linear-gradient(135deg, rgba(10,15,37,.95) 0%, rgba(15,24,60,.92) 100%); border-bottom: 1px solid var(--tech-border); backdrop-filter: blur(10px); color: white; padding: 2rem 2.5rem 2.2rem; z-index: 2; }
.scan-line { position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, var(--tech-blue), var(--tech-cyan), var(--tech-purple), transparent); animation: scanLine 4s linear infinite; }
@keyframes scanLine { 0%{transform:translateX(-100%);} 100%{transform:translateX(100%);} }
.tech-badge { display: inline-flex; align-items: center; gap: 8px; padding: 4px 12px; background: rgba(0,212,255,.1); border: 1px solid var(--tech-border); border-radius: 20px; font-size: .78rem; letter-spacing: 1px; color: var(--tech-cyan); margin-bottom: 1rem; }
.tech-badge .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--tech-cyan); box-shadow: 0 0 8px var(--tech-cyan); animation: blink 1.2s ease-in-out infinite; }
@keyframes blink { 0%,100%{opacity:1;} 50%{opacity:.3;} }
.header .logo h1 { font-size: 2.1rem; margin-bottom: .4rem; font-weight: 800; letter-spacing: 1px; }
.glitch { background: linear-gradient(135deg, var(--tech-blue), var(--tech-cyan)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; text-shadow: 0 0 30px rgba(0,212,255,.3); position: relative; }
.glitch::after { content: attr(data-text); position: absolute; left: 2px; top: 0; color: var(--tech-purple); opacity: .4; z-index: -1; animation: glitchShift 3s ease-in-out infinite; }
@keyframes glitchShift { 0%,100%{transform:translate(0);} 20%{transform:translate(-2px,1px);} 40%{transform:translate(2px,-1px);} 60%{transform:translate(-1px,-1px);} 80%{transform:translate(1px,2px);} }
.title-sub { font-size: 1.5rem; color: #e0f2fe; font-weight: 500; }
.header .subtitle { font-size: .95rem; color: rgba(180,220,255,.7); margin-bottom: 1.5rem; letter-spacing: .5px; }
.header-stats { display: flex; gap: 2.5rem; flex-wrap: wrap; }
.stat { display: flex; flex-direction: column; gap: 2px; padding: 8px 16px; border-left: 2px solid var(--tech-blue); background: linear-gradient(90deg, rgba(0,212,255,.08), transparent); }
.stat-val { font-size: 1.4rem; font-weight: 700; color: var(--tech-cyan); text-shadow: 0 0 12px rgba(34,247,201,.4); font-family: 'SF Mono','Consolas',monospace; }
.stat-label { font-size: .75rem; color: rgba(180,220,255,.6); letter-spacing: 1px; }

.sidebar { position: relative; width: 240px; background: linear-gradient(180deg, rgba(10,15,37,.85) 0%, rgba(5,8,22,.95) 100%); border-right: 1px solid var(--tech-border); padding: 1.5rem 0 1rem; backdrop-filter: blur(10px); z-index: 2; }
.nav-title { padding: 0 1.5rem 1rem; margin-bottom: .5rem; font-size: .78rem; font-weight: 700; letter-spacing: 2px; color: var(--tech-blue); border-bottom: 1px solid var(--tech-border); }
.nav-list { list-style: none; }
.nav-list li { display: flex; align-items: center; gap: 10px; padding: .9rem 1.5rem; margin: 2px 1rem; border-radius: 8px; cursor: none; transition: all .25s ease; font-size: .92rem; color: rgba(180,220,255,.7); position: relative; }
.nav-arrow { color: var(--tech-blue); transition: transform .25s ease; opacity: .5; font-size: .8rem; }
.nav-list li:hover { background: linear-gradient(90deg, rgba(0,212,255,.15), rgba(124,92,255,.08)); color: var(--tech-cyan); transform: translateX(3px); }
.nav-list li:hover .nav-arrow { opacity: 1; transform: translateX(3px); }
.nav-list li.active { background: linear-gradient(90deg, rgba(0,212,255,.22), rgba(124,92,255,.12)); color: #fff; font-weight: 600; box-shadow: 0 0 20px rgba(0,212,255,.1); border: 1px solid var(--tech-border); }
.nav-list li.active .nav-arrow { opacity: 1; color: var(--tech-cyan); transform: rotate(90deg); }
.nav-list li.active::before { content: ''; position: absolute; left: -1rem; top: 50%; transform: translateY(-50%); width: 3px; height: 60%; background: linear-gradient(180deg, var(--tech-blue), var(--tech-cyan)); border-radius: 0 3px 3px 0; box-shadow: 0 0 10px var(--tech-blue); }
.nav-footer { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.5rem 0; border-top: 1px solid var(--tech-border); position: absolute; bottom: 1rem; left: 0; right: 0; }
.version { font-size: .75rem; color: rgba(180,220,255,.4); font-family: 'SF Mono',monospace; letter-spacing: 1px; }
.status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--tech-cyan); box-shadow: 0 0 8px var(--tech-cyan); animation: blink 1.2s ease-in-out infinite; }

.main-content { flex: 1; padding: 1.8rem 2.2rem; overflow-y: auto; background: transparent; z-index: 2; max-height: calc(100vh - 180px); scrollbar-width: thin; scrollbar-color: var(--tech-blue) transparent; }
.main-content::-webkit-scrollbar { width: 6px; }
.main-content::-webkit-scrollbar-thumb { background: linear-gradient(180deg, var(--tech-blue), var(--tech-purple)); border-radius: 3px; }
.content-panel { position: relative; padding: 2rem 2.5rem; background: linear-gradient(135deg, rgba(10,15,37,.75) 0%, rgba(5,8,22,.65) 100%); border: 1px solid var(--tech-border); border-radius: 12px; backdrop-filter: blur(8px); box-shadow: 0 0 40px rgba(0,212,255,.05); }
.content-panel::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, var(--tech-blue), var(--tech-cyan), transparent); opacity: .5; border-radius: 12px 12px 0 0; }
.content-panel::after { content: ''; position: absolute; top: 8px; left: 8px; width: 12px; height: 12px; border-top: 2px solid var(--tech-blue); border-left: 2px solid var(--tech-blue); border-radius: 4px 0 0 0; opacity: .7; }

.loading { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 50vh; color: var(--tech-blue); }
.tech-spinner { position: relative; width: 80px; height: 80px; margin-bottom: 1.5rem; }
.tech-spinner .ring { position: absolute; inset: 0; border-radius: 50%; border: 2px solid transparent; }
.ring-1 { border-top-color: var(--tech-blue); border-right-color: var(--tech-cyan); animation: spin 1.2s linear infinite; }
.ring-2 { inset: 10px; border-bottom-color: var(--tech-purple); border-left-color: var(--tech-blue); animation: spin 1.6s linear infinite reverse; opacity: .8; }
.ring-3 { inset: 20px; border-top-color: var(--tech-cyan); animation: spin 1s linear infinite; opacity: .6; }
@keyframes spin { to { transform: rotate(360deg); } }
.loading-text { font-size: .85rem; letter-spacing: 3px; animation: textBlink 1.5s ease-in-out infinite; font-family: 'SF Mono',monospace; }
@keyframes textBlink { 0%,100%{opacity:.5;} 50%{opacity:1;} }

.footer { position: relative; width: 100%; background: linear-gradient(180deg, rgba(5,8,22,.9), rgba(10,15,37,.95)); border-top: 1px solid var(--tech-border); padding: .9rem; z-index: 2; }
.footer-inner { display: flex; align-items: center; justify-content: center; gap: 1rem; font-size: .75rem; letter-spacing: 1.5px; color: rgba(180,220,255,.5); flex-wrap: wrap; }
.footer-dot { color: var(--tech-blue); }
.footer-tag { font-family: 'SF Mono',monospace; color: var(--tech-cyan); }
.footer-time { font-family: 'SF Mono',monospace; color: var(--tech-purple); }

@media (min-width: 768px) {
  .app-container { flex-direction: row; flex-wrap: wrap; }
  .header { order: 1; width: 100%; }
  .sidebar { order: 2; height: calc(100vh - 180px); position: sticky; top: 0; }
  .main-content { order: 3; height: calc(100vh - 180px); }
  .footer { order: 4; width: 100%; }
}
@media (max-width: 767px) {
  .sidebar { width: 100%; border-right: none; border-bottom: 1px solid var(--tech-border); padding: 1rem 0 0; }
  .nav-list { display: flex; flex-wrap: wrap; gap: .5rem; padding: 0 1rem 1rem; }
  .nav-list li { padding: .5rem 1rem; border-radius: 6px; margin: 0; }
  .nav-list li.active::before { display: none; }
  .main-content { padding: 1rem; max-height: none; height: auto; }
  .content-panel { padding: 1.2rem; }
  .header { padding: 1.5rem; }
  .header-stats { gap: 1rem; }
  .nav-footer { position: relative; padding: 1rem 1.5rem; }
  .cursor-glow { width: 300px; height: 300px; }
}
</style>
