import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Sparkles, BookOpen, Layout, PenTool, Quote, Loader2,
  Copy, Check, Home, FileText, History, Trash2, Download,
  Compass, CheckCircle2, Circle, ListTodo, GraduationCap,
  Moon, Sun, Plus, Target, BarChart3, Timer, BookMarked,
  MessageCircleWarning, ArrowUpRight, FileJson, Pause, Play,
  StickyNote, AlignLeft, RefreshCw, Search, Printer, BookCopy, Save, Cloud
} from 'lucide-react';
import { db } from './firebase';
import {
  collection, doc, setDoc, deleteDoc, onSnapshot,
  query, orderBy, serverTimestamp, getDoc
} from 'firebase/firestore';

// --- CONFIG ---
const API_KEY = "AIzaSyDL4KUxvFd8eueVQG2N-qpXoaTLjxSItqs";
const MODEL = "gemini-2.5-flash";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

// LocalStorage apenas para preferências de UI
const loadPref = (key, def) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; } };
const savePref = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };

// ID do utilizador fixo (app pessoal do Marcio)
const USER_ID = 'marcio-souza';

// --- FERRAMENTAS ---
const TOOLS = [
  { id: 'brainstorm', name: 'Ideias de Temas', icon: <Compass className="w-5 h-5"/>, color: 'text-violet-500', bg: 'bg-violet-500/10', prompt: 'És orientador académico rigoroso. Sugere 5 temas de TCC inovadores e bem delimitados para a área de interesse. Para cada tema: **Título**, **Problema de Pesquisa**, **Objetivo Geral** e **Justificativa**. Use Markdown. Interesse do aluno: ' },
  { id: 'outline', name: 'Estrutura ABNT', icon: <Layout className="w-5 h-5"/>, color: 'text-blue-500', bg: 'bg-blue-500/10', prompt: 'Cria um sumário detalhado seguindo ABNT NBR 14724. Inclui numeração, Introdução, Referencial Teórico, Metodologia, Resultados Esperados, Conclusão e Referências. Estima páginas para cada seção. Tema: ' },
  { id: 'writer', name: 'Redação Científica', icon: <PenTool className="w-5 h-5"/>, color: 'text-orange-500', bg: 'bg-orange-500/10', prompt: 'Escreve um texto acadêmico formal e rigoroso em Português do Brasil. Use voz passiva, citações indiretas e conectivos científicos. Evita plágio. Produz pelo menos 400 palavras. Use Markdown com títulos e subtítulos. Tópico: ' },
  { id: 'intro', name: 'Introdução', icon: <BookOpen className="w-5 h-5"/>, color: 'text-cyan-500', bg: 'bg-cyan-500/10', prompt: 'Escreve uma INTRODUÇÃO completa para TCC seguindo ABNT. Deve conter: contextualização do problema, justificativa, objetivos (geral e específicos), delimitação do estudo e estrutura do trabalho. Mínimo 500 palavras. Tema: ' },
  { id: 'methodology', name: 'Metodologia', icon: <AlignLeft className="w-5 h-5"/>, color: 'text-teal-500', bg: 'bg-teal-500/10', prompt: 'Escreve um capítulo de METODOLOGIA completo para TCC. Inclui: tipo de pesquisa, abordagem (qualitativa/quantitativa), universo e amostra, instrumentos de coleta, procedimentos de análise. Justifica cada escolha metodológica. Tema do TCC: ' },
  { id: 'reviewer', name: 'Revisor Crítico', icon: <MessageCircleWarning className="w-5 h-5"/>, color: 'text-red-500', bg: 'bg-red-500/10', prompt: 'Atua como avaliador de banca examinadora. Analisa o texto abaixo em 4 dimensões: **Clareza e Coesão**, **Rigor Científico**, **Conformidade ABNT** e **Qualidade do Argumento**. Aponta problemas específicos com sugestões de correção. Texto: ' },
  { id: 'bibliography', name: 'Fontes e Citações', icon: <BookMarked className="w-5 h-5"/>, color: 'text-emerald-500', bg: 'bg-emerald-500/10', prompt: 'Sugere 8 referências bibliográficas REAIS e relevantes (livros, artigos e dissertações). Para cada uma: autor, ano, título, e explica a relevância para o tema. Formata em ABNT NBR 6023. Assunto: ' },
  { id: 'abstract', name: 'Resumo e Abstract', icon: <FileText className="w-5 h-5"/>, color: 'text-pink-500', bg: 'bg-pink-500/10', prompt: 'Gera RESUMO em Português (250 palavras) e ABSTRACT em Inglês (250 words) conforme ABNT NBR 6028. Inclui: objetivos, metodologia, resultados esperados e conclusão. Adiciona 5 palavras-chave/keywords. Texto base: ' },
  { id: 'references', name: 'Referências ABNT', icon: <Quote className="w-5 h-5"/>, color: 'text-amber-500', bg: 'bg-amber-500/10', prompt: 'Formata corretamente nas normas ABNT NBR 6023 (2018). Ordena alfabeticamente. Aplica todos os padrões (negrito, itálico, pontuação). Dados fornecidos: ' },
];

const CHAPTERS = ['Introdução', 'Referencial Teórico', 'Metodologia', 'Resultados', 'Discussão', 'Conclusão', 'Referências'];

// --- MARKDOWN RENDERER simples ---
function renderMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold mt-5 mb-2 text-slate-800 dark:text-white">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-6 mb-3 text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-black mt-6 mb-4 text-slate-900 dark:text-white">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc mb-1">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal mb-1"><span class="font-bold mr-1">$1.</span> $2</li>')
    .replace(/\n\n/g, '</p><p class="mb-4">')
    .replace(/^(?!<[h|l|p])(.+)$/gm, (m) => m.trim() ? m : '');
}

export default function App() {
  const [darkMode, setDarkMode] = useState(() => loadPref('tcc-dark', true));
  const [activeTab, setActiveTab] = useState('home');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [dbLoading, setDbLoading] = useState(true);

  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [generations, setGenerations] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [notes, setNotes] = useState({});
  const [chapterStatus, setChapterStatus] = useState({});

  const [timer, setTimer] = useState(25 * 60);
  const [timerActive, setTimerActive] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [historySearch, setHistorySearch] = useState('');
  const [savedAt, setSavedAt] = useState(null);
  const wordCount = useMemo(() => result ? result.split(/\s+/).filter(Boolean).length : 0, [result]);

  // --- FIRESTORE: Listeners em Tempo Real ---
  useEffect(() => {
    setDbLoading(true);
    // Projetos
    const unsubProjects = onSnapshot(
      query(collection(db, 'users', USER_ID, 'projects'), orderBy('createdAt', 'desc')),
      (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setProjects(data);
        setActiveProjectId(prev => prev || (data.length > 0 ? data[0].id : null));
        setDbLoading(false);
      },
      (err) => { console.error('Firestore error:', err); setDbLoading(false); }
    );
    // Textos gerados
    const unsubGen = onSnapshot(
      query(collection(db, 'users', USER_ID, 'generations'), orderBy('at', 'desc')),
      (snap) => setGenerations(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    // Tarefas
    const unsubTasks = onSnapshot(
      query(collection(db, 'users', USER_ID, 'tasks'), orderBy('order', 'asc')),
      (snap) => setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    // Notas e capítulos (documento de configuração)
    const unsubConfig = onSnapshot(
      doc(db, 'users', USER_ID, 'config', 'main'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.notes) setNotes(data.notes);
          if (data.chapterStatus) setChapterStatus(data.chapterStatus);
        }
      }
    );
    return () => { unsubProjects(); unsubGen(); unsubTasks(); unsubConfig(); };
  }, []);

  // Dark mode preference (local)
  useEffect(() => savePref('tcc-dark', darkMode), [darkMode]);


  // dark mode class
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // pomodoro
  useEffect(() => {
    let iv;
    if (timerActive && timer > 0) iv = setInterval(() => setTimer(t => t - 1), 1000);
    else if (timer === 0) setTimerActive(false);
    return () => clearInterval(iv);
  }, [timerActive, timer]);

  const project = useMemo(() => projects.find(p => p.id === activeProjectId), [projects, activeProjectId]);
  const tool = useMemo(() => TOOLS.find(t => t.id === activeTab), [activeTab]);
  const projGen = useMemo(() => generations.filter(g => g.pid === activeProjectId).sort((a,b) => b.at - a.at), [generations, activeProjectId]);
  const filteredGen = useMemo(() => {
    if (!historySearch.trim()) return projGen;
    const q = historySearch.toLowerCase();
    return projGen.filter(g => g.input.toLowerCase().includes(q) || g.output.toLowerCase().includes(q) || g.toolName.toLowerCase().includes(q));
  }, [projGen, historySearch]);
  const projTasks = useMemo(() => tasks.filter(t => t.pid === activeProjectId).sort((a,b) => (a.order||0)-(b.order||0)), [tasks, activeProjectId]);
  const completedTasks = projTasks.filter(t => t.done).length;
  const projNote = notes[activeProjectId] || '';

  // PDF export: abre janela de impressão com conteúdo formatado
  const exportPDF = useCallback((content, title) => {
    const w = window.open('', '_blank');
    w.document.write(`
      <!DOCTYPE html><html lang="pt-BR"><head>
      <meta charset="UTF-8"/>
      <title>${title || 'TCC'}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.8; color: #000; background: #fff; padding: 3cm 3cm 2cm 4cm; }
        h1 { font-size: 14pt; font-weight: bold; text-transform: uppercase; text-align: center; margin: 24pt 0 12pt; }
        h2 { font-size: 13pt; font-weight: bold; text-transform: uppercase; margin: 20pt 0 8pt; }
        h3 { font-size: 12pt; font-weight: bold; margin: 16pt 0 6pt; }
        p { margin-bottom: 10pt; text-align: justify; text-indent: 1.25cm; }
        ul, ol { margin: 8pt 0 8pt 1.25cm; }
        li { margin-bottom: 4pt; }
        strong { font-weight: bold; }
        em { font-style: italic; }
        .cover { text-align: center; margin-bottom: 60pt; }
        .cover h1 { font-size: 16pt; margin: 40pt 0 16pt; }
        .cover .author { font-size: 13pt; margin: 8pt 0; font-weight: bold; }
        .cover .date { margin-top: 40pt; font-size: 11pt; }
        @media print { body { padding: 3cm 3cm 2cm 4cm; } }
      </style>
      </head><body>
      <div class="cover">
        <p style="font-weight:bold;">Marcio de Souza</p>
        <h1>${title || project?.title || 'TCC'}</h1>
        <p class="date">${new Date().toLocaleDateString('pt-BR', {year:'numeric',month:'long'})}</p>
      </div>
      ${content}
      </body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); }, 800);
  }, [project]);

  const exportCurrentResultPDF = () => {
    if (!result) return;
    const html = `<h1>${tool?.name || 'Resultado'}</h1><p style="text-indent:0;font-style:italic;margin-bottom:16pt;">Entrada: ${input.substring(0,200)}${input.length>200?'...':''}</p>${result.replace(/^### (.+)$/gm,'<h3>$1</h3>').replace(/^## (.+)$/gm,'<h2>$1</h2>').replace(/^# (.+)$/gm,'<h1>$1</h1>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>').replace(/^- (.+)$/gm,'<li>$1</li>').replace(/\n\n/g,'</p><p>')}`;
    exportPDF(html, tool?.name || 'Resultado');
  };

  const exportFullTCCPDF = () => {
    if (!projGen.length) return;
    const grouped = TOOLS.map(t => ({ tool: t, items: projGen.filter(g => g.toolId === t.id) })).filter(g => g.items.length > 0);
    const html = grouped.map(g => `
      <h1>${g.tool.name}</h1>
      ${g.items.map(item => `
        <p style="font-style:italic;font-size:10pt;text-indent:0;">Gerado em: ${new Date(item.at).toLocaleString('pt-BR')}</p>
        ${item.output.replace(/^### (.+)$/gm,'<h3>$1</h3>').replace(/^## (.+)$/gm,'<h2>$1</h2>').replace(/^# (.+)$/gm,'<h1>$1</h1>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>').replace(/^- (.+)$/gm,'<li>$1</li>').replace(/\n\n/g,'</p><p>')}
        <p style="page-break-after:always;"></p>
      `).join('')}
    `).join('');
    exportPDF(html, `TCC Completo - ${project?.title || 'Projeto'}`);
  };

  const callAI = async () => {
    if (!input.trim()) return;
    if (!activeProjectId) { setError('Cria ou seleciona um projeto primeiro!'); return; }
    setLoading(true); setError(null); setResult('');
    const prompt = tool ? `${tool.prompt}${input}` : input;
    const sys = `És o TCC Master Pro, assistente especialista em pesquisa académica brasileira. Projeto atual: "${project?.title || 'TCC'}". Responde sempre em Português do Brasil com rigor científico e normas ABNT.`;
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: sys }] },
          generationConfig: { temperature: 0.7, maxOutputTokens: 4096 }
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const out = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!out) throw new Error('Resposta vazia da API');
      setResult(out);
      const genId = Date.now()+'';
      const genData = {
        pid: activeProjectId, toolId: activeTab,
        toolName: tool?.name || 'Chat', input, output: out, at: Date.now()
      };
      await setDoc(doc(db, 'users', USER_ID, 'generations', genId), genData);
      setSavedAt(new Date());
    } catch (e) {
      setError(`Erro: ${e.message}`);
    } finally { setLoading(false); }
  };

  const createProject = async () => {
    const title = prompt('Nome do projeto TCC (ex: TCC Direito Civil):');
    if (!title?.trim()) return;
    const id = Date.now()+'';
    await setDoc(doc(db, 'users', USER_ID, 'projects', id), {
      title: title.trim(), createdAt: Date.now()
    });
    setActiveProjectId(id);
    setSavedAt(new Date());
  };

  const deleteProject = async () => {
    if (!activeProjectId || !window.confirm('Eliminar projeto e todos os dados?')) return;
    await deleteDoc(doc(db, 'users', USER_ID, 'projects', activeProjectId));
    // Apaga textos e tarefas do projeto
    const pGen = generations.filter(g => g.pid === activeProjectId);
    const pTasks = tasks.filter(t => t.pid === activeProjectId);
    await Promise.all([
      ...pGen.map(g => deleteDoc(doc(db, 'users', USER_ID, 'generations', g.id))),
      ...pTasks.map(t => deleteDoc(doc(db, 'users', USER_ID, 'tasks', t.id)))
    ]);
    const remaining = projects.filter(p => p.id !== activeProjectId);
    setActiveProjectId(remaining[0]?.id || null);
    setActiveTab('home');
  };

  const addTask = async () => {
    const text = prompt('Nome da etapa do TCC:');
    if (!text?.trim() || !activeProjectId) return;
    const id = Date.now()+''+Math.random();
    await setDoc(doc(db, 'users', USER_ID, 'tasks', id), {
      pid: activeProjectId, text: text.trim(), done: false, order: tasks.length
    });
    setSavedAt(new Date());
  };

  const toggleChapter = async (ch) => {
    const key = `${activeProjectId}-${ch}`;
    const updated = { ...chapterStatus, [key]: !chapterStatus[key] };
    setChapterStatus(updated);
    await setDoc(doc(db, 'users', USER_ID, 'config', 'main'),
      { chapterStatus: updated, notes }, { merge: true });
    setSavedAt(new Date());
  };
  const updateNote = async (val) => {
    const updated = { ...notes, [activeProjectId]: val };
    setNotes(updated);
    await setDoc(doc(db, 'users', USER_ID, 'config', 'main'),
      { notes: updated, chapterStatus }, { merge: true });
    setSavedAt(new Date());
  };

  const isChapterDone = (ch) => chapterStatus[`${activeProjectId}-${ch}`];
  const completedChapters = CHAPTERS.filter(ch => isChapterDone(ch)).length;

  const copyText = () => {
    navigator.clipboard.writeText(result).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const exportMd = () => {
    const blob = new Blob([`# ${tool?.name || 'Resultado'}\n\n${result}`], { type: 'text/markdown' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `${(project?.title || 'tcc').replace(/\s+/g,'-')}-${tool?.id||'nota'}.md`; a.click();
  };

  const SBtn = ({ id, icon, label, color='text-slate-500' }) => (
    <button onClick={() => setActiveTab(id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-semibold ${activeTab===id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : `${color} hover:bg-slate-100 dark:hover:bg-slate-800`}`}>
      <span className={activeTab===id ? 'text-white' : ''}>{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );

  return (
    <div className={`flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors`}>

      {/* SIDEBAR */}
      <aside className={`${sidebarOpen ? 'w-72' : 'w-0'} hidden lg:flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 overflow-hidden flex-shrink-0`}>
        <div className="flex flex-col h-full p-4 gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3 px-2 py-3 cursor-pointer" onClick={() => setActiveTab('home')}>
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Sparkles className="w-5 h-5 text-white"/>
            </div>
            <div>
              <h1 className="font-black text-sm leading-none">TCC <span className="text-indigo-500">Master</span></h1>
              <p className="text-[10px] text-slate-400 font-medium tracking-wide leading-tight mt-0.5">Marcio de Souza</p>
            </div>
          </div>

          {/* Projetos */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-2 mb-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Projetos</span>
              <button onClick={createProject} className="p-1 rounded-lg text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"><Plus className="w-4 h-4"/></button>
            </div>
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {projects.map(p => (
                <button key={p.id} onClick={() => setActiveProjectId(p.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${activeProjectId===p.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' : 'border-transparent text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                  <GraduationCap className="w-4 h-4 flex-shrink-0"/>
                  <span className="truncate">{p.title}</span>
                </button>
              ))}
              {projects.length === 0 && <p className="text-xs text-slate-400 px-3 py-2">Nenhum projeto ainda</p>}
            </div>
          </div>

          <div className="h-px bg-slate-100 dark:bg-slate-800"/>

          {/* Nav */}
          <nav className="space-y-0.5 flex-1 overflow-y-auto">
            <SBtn id="home" icon={<Home className="w-4 h-4"/>} label="Dashboard"/>
            <SBtn id="progress" icon={<BarChart3 className="w-4 h-4"/>} label="Progresso do TCC"/>
            <SBtn id="compiler" icon={<BookCopy className="w-4 h-4"/>} label="Compilar TCC Completo"/>
            <SBtn id="notes" icon={<StickyNote className="w-4 h-4"/>} label="Notas do Projeto"/>
            <div className="h-px bg-slate-100 dark:bg-slate-800 my-2"/>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-1">Ferramentas IA</p>
            {TOOLS.map(t => <SBtn key={t.id} id={t.id} icon={t.icon} label={t.name} color={t.color}/>)}
            <div className="h-px bg-slate-100 dark:bg-slate-800 my-2"/>
            <SBtn id="history" icon={<History className="w-4 h-4"/>} label="Histórico" color="text-slate-500"/>
          </nav>

          {/* Pomodoro */}
          <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-3 border border-slate-100 dark:border-slate-700">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><Timer className="w-3 h-3"/> Pomodoro</span>
              <button onClick={() => setTimer(25*60)} className="text-[10px] text-slate-400 hover:text-slate-600"><RefreshCw className="w-3 h-3"/></button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-black font-mono text-slate-800 dark:text-white">{Math.floor(timer/60)}:{String(timer%60).padStart(2,'0')}</span>
              <button onClick={() => setTimerActive(!timerActive)} className={`p-2 rounded-xl text-white text-xs ${timerActive ? 'bg-red-500' : 'bg-orange-500'}`}>
                {timerActive ? <Pause className="w-4 h-4"/> : <Play className="w-4 h-4"/>}
              </button>
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="flex items-center justify-between">
            <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
              {darkMode ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
            </button>
            {activeProjectId && (
              <button onClick={deleteProject} className="p-2 rounded-xl text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                <Trash2 className="w-4 h-4"/>
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl flex items-center px-6 gap-4 sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(s => !s)} className="lg:flex hidden p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <Layout className="w-4 h-4"/>
          </button>
          <div>
            <h2 className="font-black text-base leading-none">
              {activeTab === 'home' ? 'Dashboard' : activeTab === 'history' ? 'Histórico' : activeTab === 'progress' ? 'Progresso TCC' : activeTab === 'notes' ? 'Notas' : tool?.name}
            </h2>
            <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider mt-0.5">{project?.title || 'Sem Projeto'}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setDarkMode(!darkMode)} className="lg:hidden p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
              {darkMode ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
            </button>
            {savedAt && <span className="hidden lg:flex items-center gap-1 text-[10px] text-green-500 font-bold"><Save className="w-3 h-3"/> Salvo {savedAt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span>}
            {activeProjectId && wordCount > 0 && (
              <span className="text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 px-3 py-1 rounded-full font-bold">{wordCount} palavras</span>
            )}
            {activeProjectId && projGen.length > 0 && (
              <button onClick={exportFullTCCPDF} className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 border border-red-200 dark:border-red-800 rounded-xl text-xs font-black hover:bg-red-100 transition-all">
                <Printer className="w-3.5 h-3.5"/> Exportar TCC PDF
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 pb-24 lg:pb-6">
          <div className="max-w-4xl mx-auto space-y-6">

            {/* Gate: sem projeto */}
            {!activeProjectId && activeTab !== 'home' && (
              <div className="text-center py-32">
                <Target className="w-14 h-14 text-slate-200 dark:text-slate-800 mx-auto mb-4"/>
                <h3 className="text-xl font-black text-slate-400">Cria um projeto para começar</h3>
                <p className="text-slate-400 text-sm mt-2 mb-6">Todo o histórico e dados ficam separados por projeto</p>
                <button onClick={createProject} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20">+ Novo Projeto</button>
              </div>
            )}

            {/* HOME */}
            {activeTab === 'home' && (
              <div className="space-y-6">
                {/* Hero */}
                <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-500/20">
                  <div className="relative z-10">
                    <div className="inline-block bg-white/20 text-xs font-black uppercase px-3 py-1 rounded-full mb-4 backdrop-blur-md">IA Académica Ativa</div>
                    <h3 className="text-4xl font-black tracking-tight mb-3">TCC Sem Stress,<br/>Com Qualidade.</h3>
                    <p className="text-indigo-100 max-w-sm mb-6 text-sm leading-relaxed">Escreva, revise e organize o seu Trabalho de Conclusão com a ajuda da Inteligência Artificial mais avançada do Google.</p>
                    <div className="flex gap-3 flex-wrap">
                      <button onClick={() => setActiveTab('writer')} className="bg-white text-indigo-700 px-5 py-2.5 rounded-xl font-black text-sm hover:scale-105 transition-all shadow-xl">Começar a Escrever</button>
                      <button onClick={() => setActiveTab('brainstorm')} className="bg-white/20 text-white border border-white/30 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-white/30 transition-all">Explorar Temas</button>
                      {!activeProjectId && <button onClick={createProject} className="bg-white/20 text-white border border-white/30 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-white/30 transition-all">+ Novo Projeto</button>}
                    </div>
                  </div>
                  <Sparkles className="absolute -right-8 -top-8 w-64 h-64 text-white/10"/>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Tasks */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-black text-sm flex items-center gap-2"><ListTodo className="w-4 h-4 text-indigo-500"/> Etapas</h4>
                      <button onClick={addTask} className="p-1.5 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg"><Plus className="w-4 h-4"/></button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {projTasks.map(t => (
                        <button key={t.id} onClick={async () => {
                            await setDoc(doc(db, 'users', USER_ID, 'tasks', t.id), { ...t, done: !t.done });
                            setSavedAt(new Date());
                          }}
                          className="flex items-center gap-2 w-full text-left p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group">
                          {t.done ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0"/> : <Circle className="w-5 h-5 text-slate-300 flex-shrink-0"/>}
                          <span className={`text-xs font-medium ${t.done ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>{t.text}</span>
                          <Trash2 className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 ml-auto" onClick={async e => { e.stopPropagation(); await deleteDoc(doc(db, 'users', USER_ID, 'tasks', t.id)); setSavedAt(new Date()); }}/>
                        </button>
                      ))}
                      {projTasks.length === 0 && <p className="text-xs text-slate-400 text-center py-4">Adiciona etapas do TCC</p>}
                    </div>
                    {projTasks.length > 0 && <div className="mt-3 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full transition-all" style={{width: `${(completedTasks/projTasks.length)*100}%`}}/></div>}
                  </div>

                  {/* Progresso Capítulos */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                    <h4 className="font-black text-sm flex items-center gap-2 mb-4"><BookOpen className="w-4 h-4 text-indigo-500"/> Capítulos</h4>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {CHAPTERS.map(ch => (
                        <button key={ch} onClick={() => toggleChapter(ch)} className="flex items-center gap-2 w-full text-left p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                          {isChapterDone(ch) ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0"/> : <Circle className="w-4 h-4 text-slate-300 flex-shrink-0"/>}
                          <span className={`text-xs font-medium ${isChapterDone(ch) ? 'text-green-600 dark:text-green-400' : 'text-slate-600 dark:text-slate-400'}`}>{ch}</span>
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 rounded-full transition-all" style={{width: `${(completedChapters/CHAPTERS.length)*100}%`}}/></div>
                    <p className="text-[10px] text-slate-400 mt-1 font-bold">{completedChapters}/{CHAPTERS.length} capítulos</p>
                  </div>

                  {/* Stats */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
                    <h4 className="font-black text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4 text-indigo-500"/> Stats</h4>
                    {[
                      { label: 'Textos Gerados', val: projGen.length, color: 'text-indigo-500' },
                      { label: 'Total de Palavras', val: totalWords.toLocaleString('pt-BR'), color: 'text-violet-500' },
                      { label: 'Etapas Concluídas', val: `${completedTasks}/${projTasks.length}`, color: 'text-green-500' },
                      { label: 'Capítulos OK', val: `${completedChapters}/${CHAPTERS.length}`, color: 'text-amber-500' },
                    ].map(s => (
                      <div key={s.label} className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 font-medium">{s.label}</span>
                        <span className={`text-xl font-black ${s.color}`}>{s.val}</span>
                      </div>
                    ))}
                    {activeProjectId && projGen.length > 0 && (
                      <button onClick={exportFullTCCPDF} className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-500 text-white rounded-xl text-xs font-black hover:bg-red-600 transition-all mt-2">
                        <Printer className="w-4 h-4"/> Exportar TCC em PDF
                      </button>
                    )}
                  </div>
                </div>

                {/* Ferramentas rápidas */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {TOOLS.slice(0, 6).map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-left hover:border-indigo-400 hover:shadow-lg transition-all group">
                      <div className={`w-9 h-9 rounded-xl ${t.bg} ${t.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>{t.icon}</div>
                      <p className="text-sm font-bold text-slate-800 dark:text-white leading-tight">{t.name}</p>
                      <p className="text-[10px] text-slate-400 mt-1 font-medium">Abrir ferramenta →</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* PROGRESS */}
            {activeTab === 'progress' && (
              <div className="space-y-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                  <h3 className="font-black text-lg mb-2">Progresso Geral</h3>
                  <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-2">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all" style={{width: `${(completedChapters/CHAPTERS.length)*100}%`}}/>
                  </div>
                  <p className="text-sm text-slate-500">{Math.round((completedChapters/CHAPTERS.length)*100)}% concluído · {completedChapters} de {CHAPTERS.length} capítulos</p>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                  <h3 className="font-black text-base mb-4">Marcar Capítulos como Concluídos</h3>
                  <div className="space-y-2">
                    {CHAPTERS.map(ch => (
                      <button key={ch} onClick={() => toggleChapter(ch)} className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all font-semibold text-sm ${isChapterDone(ch) ? 'border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 text-slate-600 dark:text-slate-400'}`}>
                        {isChapterDone(ch) ? <CheckCircle2 className="w-5 h-5 text-green-500"/> : <Circle className="w-5 h-5 text-slate-300"/>}
                        {ch}
                        <span className="ml-auto text-xs">{isChapterDone(ch) ? '✓ Concluído' : 'Pendente'}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* NOTES */}
            {activeTab === 'notes' && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <StickyNote className="w-5 h-5 text-amber-500"/>
                  <h3 className="font-black text-base">Notas – {project?.title || 'Projeto'}</h3>
                </div>
                {!activeProjectId
                  ? <p className="text-slate-400 text-sm">Seleciona um projeto para ver as notas</p>
                  : <textarea
                      value={projNote}
                      onChange={e => updateNote(e.target.value)}
                      placeholder="Escreve aqui observações do orientador, citações importantes, ideias rápidas..."
                      className="w-full h-96 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-300 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono leading-relaxed"
                    />
                }
              </div>
            )}

            {/* TOOL VIEW */}
            {tool && (
              <div className="space-y-4">
                {/* Tool card */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className={`px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 ${tool.bg}`}>
                    <div className={`${tool.color}`}>{tool.icon}</div>
                    <div>
                      <h3 className="font-black text-base text-slate-800 dark:text-white">{tool.name}</h3>
                      <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">Motor Gemini 2.5 · ABNT</p>
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    <textarea
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => { if (e.ctrlKey && e.key === 'Enter') callAI(); }}
                      placeholder="Descreve o assunto, tópico ou cole o texto para análise... (Ctrl+Enter para gerar)"
                      className="w-full min-h-36 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y text-sm leading-relaxed dark:text-white"
                    />
                    {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-400 font-medium">{error}</div>}
                    <button
                      disabled={loading || !input.trim()}
                      onClick={callAI}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white py-3.5 rounded-xl font-black flex items-center justify-center gap-3 transition-all shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:scale-[1.01] active:scale-[0.99]"
                    >
                      {loading ? <><Loader2 className="w-5 h-5 animate-spin"/> Gerando texto científico...</> : <><Sparkles className="w-5 h-5"/> Gerar com IA · Ctrl+Enter</>}
                    </button>
                  </div>
                </div>

                {/* resultado */}
                {result && (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"/>
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Resultado · {wordCount} palavras</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={copyText} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all">
                          {copied ? <Check className="w-3.5 h-3.5 text-green-500"/> : <Copy className="w-3.5 h-3.5"/>}
                          {copied ? 'Copiado!' : 'Copiar'}
                        </button>
                        <button onClick={exportMd} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all">
                          <FileJson className="w-3.5 h-3.5"/> .MD
                        </button>
                        <button onClick={exportCurrentResultPDF} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 transition-all">
                          <Printer className="w-3.5 h-3.5"/> PDF
                        </button>
                        <button onClick={() => setResult('')} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all">
                          <Trash2 className="w-3.5 h-3.5"/>
                        </button>
                      </div>
                    </div>
                    <div className="p-6">
                      <div
                        className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: `<p class="mb-4">${renderMarkdown(result)}</p>` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* COMPILER */}
            {activeTab === 'compiler' && (
              <div className="space-y-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <BookCopy className="w-5 h-5 text-indigo-500"/>
                    <div>
                      <h3 className="font-black text-base">Compilador de TCC</h3>
                      <p className="text-xs text-slate-400">Junta todos os textos gerados em um único documento PDF formatado em ABNT</p>
                    </div>
                  </div>
                  {!activeProjectId ? (
                    <p className="text-slate-400 text-sm">Seleciona um projeto primeiro</p>
                  ) : projGen.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                      <BookCopy className="w-10 h-10 text-slate-300 mx-auto mb-3"/>
                      <p className="text-slate-400 text-sm font-bold">Nenhum texto gerado ainda</p>
                      <p className="text-slate-400 text-xs mt-1">Usa as ferramentas de IA para gerar o conteúdo do TCC primeiro</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {TOOLS.map(t => {
                        const items = projGen.filter(g => g.toolId === t.id);
                        if (!items.length) return null;
                        return (
                          <div key={t.id} className={`p-4 rounded-2xl border ${t.bg} border-current/10`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={t.color}>{t.icon}</span>
                                <span className={`font-bold text-sm ${t.color}`}>{t.name}</span>
                                <span className="text-[10px] text-slate-400 font-medium">{items.length} {items.length===1?'texto':'textos'}</span>
                              </div>
                              <span className="text-[10px] text-slate-400">{items.reduce((a,i) => a + i.output.split(/\s+/).filter(Boolean).length, 0).toLocaleString('pt-BR')} palavras</span>
                            </div>
                          </div>
                        );
                      })}
                      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-bold text-slate-600 dark:text-slate-300">Total de palavras:</span>
                          <span className="font-black text-violet-500 text-lg">{totalWords.toLocaleString('pt-BR')}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-bold text-slate-600 dark:text-slate-300">Estimativa de páginas (ABNT):</span>
                          <span className="font-black text-indigo-500 text-lg">{Math.round(totalWords / 250)}</span>
                        </div>
                        <button onClick={exportFullTCCPDF} className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-2xl font-black text-base hover:from-red-600 hover:to-red-700 transition-all shadow-xl shadow-red-500/20 hover:scale-[1.01] mt-2">
                          <Printer className="w-5 h-5"/> Gerar PDF Completo do TCC
                        </button>
                        <p className="text-[10px] text-slate-400 text-center">Abre um documento formatado em ABNT pronto para imprimir ou salvar como PDF</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* HISTORY */}
            {activeTab === 'history' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h3 className="font-black text-lg">Histórico do Projeto</h3>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                      <input value={historySearch} onChange={e => setHistorySearch(e.target.value)} placeholder="Buscar..." className="pl-8 pr-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white w-36"/>
                    </div>
                    <span className="text-xs bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full font-bold text-slate-500">{filteredGen.length}/{projGen.length}</span>
                  </div>
                </div>
                {projGen.length === 0
                  ? <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800"><History className="w-12 h-12 text-slate-200 dark:text-slate-800 mx-auto mb-3"/><p className="text-slate-400 text-sm font-bold">Histórico vazio. Gera o primeiro texto!</p></div>
                  : filteredGen.map(item => {
                    const t = TOOLS.find(x => x.id === item.toolId);
                    const wc = item.output.split(/\s+/).filter(Boolean).length;
                    return (
                      <div key={item.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden group">
                        <div className="px-5 py-3 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${t?.bg || 'bg-slate-100'} ${t?.color || 'text-slate-500'}`}>{item.toolName}</span>
                            <span className="text-[10px] text-slate-400">{new Date(item.at).toLocaleString('pt-BR')}</span>
                            <span className="text-[10px] text-slate-400">{wc} palavras</span>
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={() => { setInput(item.input); setResult(item.output); setActiveTab(item.toolId); }} className="text-[10px] font-bold text-indigo-500 hover:underline flex items-center gap-1">Editar <ArrowUpRight className="w-3 h-3"/></button>
                            <button onClick={() => setGenerations(prev => prev.filter(g => g.id !== item.id))} className="text-[10px] text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5"/></button>
                          </div>
                        </div>
                        <div className="p-5">
                          <blockquote className="text-xs italic text-slate-500 border-l-4 border-indigo-400 pl-3 mb-3">"{item.input.substring(0, 150)}{item.input.length > 150 ? '...' : ''}"</blockquote>
                          <div className="text-sm text-slate-600 dark:text-slate-400 line-clamp-4 font-serif leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(item.output.substring(0, 600)) }}
                          />
                          <div className="flex gap-3 mt-3">
                            <button onClick={() => navigator.clipboard.writeText(item.output)} className="text-[10px] font-bold text-slate-400 hover:text-slate-700 flex items-center gap-1"><Copy className="w-3 h-3"/> Copiar</button>
                            <button onClick={() => { const b = new Blob([item.output], {type:'text/markdown'}); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${item.toolName}.md`; a.click(); }} className="text-[10px] font-bold text-slate-400 hover:text-slate-700">Exportar .md</button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            )}
          </div>
        </div>

        {/* Mobile nav */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 flex items-center justify-around py-3 px-4 z-50">
          {[
            { id: 'home', icon: <Home className="w-6 h-6"/>, label: 'Home' },
            { id: 'writer', icon: <PenTool className="w-6 h-6"/>, label: 'Escrever' },
            { id: 'progress', icon: <BarChart3 className="w-6 h-6"/>, label: 'Progresso' },
            { id: 'notes', icon: <StickyNote className="w-6 h-6"/>, label: 'Notas' },
            { id: 'history', icon: <History className="w-6 h-6"/>, label: 'Histórico' },
          ].map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${activeTab === item.id ? 'text-indigo-500' : 'text-slate-400'}`}>
              {item.icon}
              <span className="text-[9px] font-bold">{item.label}</span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
