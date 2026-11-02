<script setup lang="ts">
import { ref, watch } from 'vue'
import { marked } from 'marked'

const props = defineProps<{ content: string }>()
const htmlContent = ref('')

const renderMarkdown = async (md: string) => {
  marked.setOptions({ gfm: true, breaks: true })
  htmlContent.value = await marked(md)
}
watch(() => props.content, async (v) => await renderMarkdown(v), { immediate: true })
</script>

<template>
  <div class="markdown-content" v-html="htmlContent"></div>
</template>

<style scoped>
.markdown-content { line-height: 1.85; color: #cfe0ff; font-size: .96rem; }
.markdown-content h1 { font-size: 1.9rem; font-weight: 700; margin-bottom: 1.5rem; padding-bottom: .8rem; border-bottom: 1px solid; border-image: linear-gradient(90deg, rgba(0,212,255,.5), rgba(124,92,255,.3), transparent) 1; background: linear-gradient(135deg, #7dd3fc, #22f7c9, #a78bfa); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: 1px; }
.markdown-content h2 { font-size: 1.45rem; font-weight: 600; margin-top: 2.2rem; margin-bottom: 1rem; color: #e0f2fe; padding-left: 14px; position: relative; }
.markdown-content h2::before { content: ''; position: absolute; left: 0; top: 20%; bottom: 20%; width: 3px; background: linear-gradient(180deg, #00d4ff, #22f7c9); border-radius: 2px; box-shadow: 0 0 8px #00d4ff; }
.markdown-content h3 { font-size: 1.15rem; font-weight: 600; margin-top: 1.6rem; margin-bottom: .7rem; color: #bae6fd; padding: 6px 12px; background: linear-gradient(90deg, rgba(0,212,255,.12), transparent); border-left: 2px solid rgba(34,247,201,.6); border-radius: 0 6px 6px 0; }
.markdown-content p { margin-bottom: 1rem; text-align: justify; color: rgba(207,224,255,.88); }
.markdown-content ul, .markdown-content ol { margin-bottom: 1rem; padding-left: 1.8rem; }
.markdown-content li { margin-bottom: .5rem; color: rgba(207,224,255,.85); position: relative; list-style: none; padding-left: 4px; }
.markdown-content ul li::before { content: '▸'; position: absolute; left: -1.2rem; color: #00d4ff; text-shadow: 0 0 5px rgba(0,212,255,.6); font-size: .8rem; top: 3px; }
.markdown-content ol { counter-reset: li; }
.markdown-content ol li::before { content: counter(li); counter-increment: li; position: absolute; left: -1.4rem; top: 0; width: 20px; height: 20px; line-height: 20px; text-align: center; font-size: .7rem; font-weight: 700; color: #050816; background: linear-gradient(135deg, #00d4ff, #22f7c9); border-radius: 4px; font-family: 'SF Mono',monospace; box-shadow: 0 0 10px rgba(0,212,255,.4); }
.markdown-content strong { font-weight: 600; color: #22f7c9; padding: 1px 4px; background: rgba(34,247,201,.08); border-radius: 3px; }
.markdown-content code { background: linear-gradient(135deg, rgba(124,92,255,.15), rgba(0,212,255,.1)); padding: .2em .55em; border-radius: 5px; font-family: 'SF Mono','Consolas',monospace; font-size: .86em; color: #a5f3fc; border: 1px solid rgba(0,212,255,.2); }
.markdown-content pre { background: linear-gradient(135deg, rgba(10,15,37,.98), rgba(5,8,22,.95)); color: #e0f2fe; padding: 1.2rem 1.4rem; border-radius: 10px; overflow-x: auto; margin-bottom: 1rem; border: 1px solid rgba(0,212,255,.2); box-shadow: 0 0 30px rgba(0,212,255,.08); }
.markdown-content pre code { background: transparent; padding: 0; border: none; color: inherit; }
.markdown-content blockquote { border-left: 3px solid; border-image: linear-gradient(180deg, #22f7c9, #7c5cff) 1; padding: 1rem 1.2rem 1rem 1.4rem; margin: 1.2rem 0; color: rgba(180,220,255,.8); background: linear-gradient(90deg, rgba(34,247,201,.08), transparent); border-radius: 0 8px 8px 0; }
.markdown-content hr { border: none; height: 1px; margin: 2.2rem 0; background: linear-gradient(90deg, transparent, rgba(0,212,255,.4), rgba(124,92,255,.3), transparent); }
.markdown-content table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 1.2rem; border-radius: 10px; border: 1px solid rgba(0,212,255,.2); background: rgba(10,15,37,.5); overflow: hidden; }
.markdown-content th, .markdown-content td { padding: .8rem 1rem; text-align: left; border-bottom: 1px solid rgba(0,212,255,.1); }
.markdown-content th { background: linear-gradient(135deg, rgba(0,212,255,.15), rgba(124,92,255,.1)); font-weight: 600; color: #e0f2fe; border-bottom: 1px solid rgba(0,212,255,.3); }
.markdown-content tr:last-child td { border-bottom: none; }
.markdown-content tr:hover td { background: rgba(0,212,255,.05); }
.markdown-content a { color: #22f7c9; text-decoration: none; border-bottom: 1px solid rgba(34,247,201,.4); transition: all .2s; }
.markdown-content a:hover { color: #00d4ff; text-shadow: 0 0 10px rgba(0,212,255,.6); }
</style>
