import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Sparkles, BookOpen, Layout, PenTool, Quote, Loader2,
  Copy, Check, Home, FileText, History, Trash2,
  Compass, CheckCircle2, Circle, ListTodo, GraduationCap,
  Moon, Sun, Plus, Target, BarChart3, Timer, BookMarked,
  MessageCircleWarning, ArrowUpRight, FileJson, Pause, Play,
  StickyNote, AlignLeft, RefreshCw, Search, Printer, BookCopy, Save,
  Send, RotateCcw, Sliders, Languages, Calendar, HelpCircle, Scissors,
  FlaskConical, ClipboardList, MessageSquare, ChevronRight,
  Mic, MicOff, Trophy
} from 'lucide-react';
import { db } from './firebase';
import {
  collection, doc, setDoc, deleteDoc, onSnapshot,
  query, orderBy, serverTimestamp, getDoc
} from 'firebase/firestore';
import confetti from 'canvas-confetti';

const MOTIVATION = [
  "Um passo de cada vez. O Vasco da Gama não foi fundado num dia!",
  "A consistência ganha da ansiedade. Foca em 25 minutos.",
  "Estás mais perto do que ontem. Bora!",
  "A pior parte é sempre começar. Confia e escreve o primeiro parágrafo.",
  "Esse diploma já tem o teu nome. Não desistas agora!",
  "Respira fundo e deixa a IA guiar-te."
];

// --- CONFIG ---
const API_KEY = "AIzaSyDL4KUxvFd8eueVQG2N-qpXoaTLjxSItqs";
const MODEL = "gemini-2.5-flash";
const STREAM_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?key=${API_KEY}&alt=sse`;

// LocalStorage apenas para preferências de UI
const loadPref = (key, def) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; } };
const savePref = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };

// ID do utilizador fixo (app pessoal do Marcio)
const USER_ID = 'marcio-souza';

// --- FERRAMENTAS (16 no total) ---
const TOOLS = [
  { id: 'brainstorm',   name: 'Ideias de Temas',          icon: <Compass className="w-5 h-5"/>,           color: 'text-violet-500',  bg: 'bg-violet-500/10',  prompt: 'És orientador académico rigoroso. Sugere 5 temas de TCC inovadores e bem delimitados. Para cada: **Título**, **Problema de Pesquisa**, **Objetivo Geral** e **Justificativa**. Interesse: ' },
  { id: 'problem',      name: 'Problema de Pesquisa',     icon: <HelpCircle className="w-5 h-5"/>,         color: 'text-rose-500',    bg: 'bg-rose-500/10',    prompt: 'Formula um PROBLEMA DE PESQUISA científico e bem delimitado. Apresenta: pergunta central, sub-perguntas, e justificativa da relevância académica. Tema: ' },
  { id: 'hypothesis',   name: 'Hipóteses',                icon: <FlaskConical className="w-5 h-5"/>,        color: 'text-purple-500',  bg: 'bg-purple-500/10',  prompt: 'Gera hipóteses de pesquisa plausíveis e testáveis. Apresenta hipótese principal (H1) e nula (H0) e hipóteses secundárias. Justifica cada uma com base teórica. Tema/Problema: ' },
  { id: 'outline',      name: 'Estrutura ABNT',           icon: <Layout className="w-5 h-5"/>,             color: 'text-blue-500',    bg: 'bg-blue-500/10',    prompt: 'Cria um sumário detalhado ABNT NBR 14724. Inclui numeração, todos os capítulos obrigatórios, estimativa de páginas. Tema: ' },
  { id: 'intro',        name: 'Introdução',               icon: <BookOpen className="w-5 h-5"/>,           color: 'text-cyan-500',    bg: 'bg-cyan-500/10',    prompt: 'Escreve INTRODUÇÃO completa para TCC (ABNT): contextualização, justificativa, objetivos geral e específicos, delimitação, estrutura do trabalho. Mínimo 500 palavras. Tema: ' },
  { id: 'writer',       name: 'Redação Científica',       icon: <PenTool className="w-5 h-5"/>,            color: 'text-orange-500',  bg: 'bg-orange-500/10',  prompt: 'Escreve texto académico formal em Português do Brasil. Voz passiva, citações indiretas, conectivos científicos. Mínimo 400 palavras com títulos e subtítulos. Tópico: ' },
  { id: 'chapter',      name: 'Desenvolvimento',          icon: <FileText className="w-5 h-5"/>,           color: 'text-indigo-500',  bg: 'bg-indigo-500/10',  prompt: 'Escreve um capítulo de DESENVOLVIMENTO completo para TCC. Inclui subtítulos, argumentação sólida, citações indiretas e conexão com o problema de pesquisa. Mínimo 600 palavras. Capítulo/Tema: ' },
  { id: 'methodology',  name: 'Metodologia',              icon: <AlignLeft className="w-5 h-5"/>,          color: 'text-teal-500',    bg: 'bg-teal-500/10',    prompt: 'Escreve capítulo de METODOLOGIA (ABNT): tipo de pesquisa, abordagem, universo/amostra, instrumentos de coleta, análise. Justifica cada escolha. Tema: ' },
  { id: 'conclusion',   name: 'Conclusão',                icon: <CheckCircle2 className="w-5 h-5"/>,       color: 'text-green-500',   bg: 'bg-green-500/10',   prompt: 'Escreve uma CONCLUSÃO académica completa para TCC. Retoma os objetivos, responde ao problema de pesquisa, sintetiza resultados, aponta limitações e sugere pesquisas futuras. Mínimo 400 palavras. Tema/Objetivos: ' },
  { id: 'paraphrase',   name: 'Paráfrase Inteligente',   icon: <Scissors className="w-5 h-5"/>,           color: 'text-yellow-500',  bg: 'bg-yellow-500/10',  prompt: 'Reescreve o texto abaixo de forma original, mantendo o significado mas alterando a estrutura e vocabulário para eliminar plágio. Mantém o tom académico formal. Texto: ' },
  { id: 'analyze',      name: 'Análise de Artigo',        icon: <Search className="w-5 h-5"/>,             color: 'text-sky-500',     bg: 'bg-sky-500/10',     prompt: 'Analisa o artigo/texto científico abaixo. Apresenta: tema central, metodologia usada, principais argumentos, limitações do estudo, e como pode ser citado num TCC. Artigo: ' },
  { id: 'questionnaire',name: 'Questionário de Pesquisa', icon: <ClipboardList className="w-5 h-5"/>,      color: 'text-lime-500',    bg: 'bg-lime-500/10',    prompt: 'Cria um questionário científico estruturado para coleta de dados primários. Inclui: objetivo, perguntas abertas e fechadas (escala Likert), e orientações para o respondente. Tema/objetivo da pesquisa: ' },
  { id: 'schedule',     name: 'Cronograma ABNT',          icon: <Calendar className="w-5 h-5"/>,           color: 'text-orange-400',  bg: 'bg-orange-400/10',  prompt: 'Cria um cronograma detalhado para elaboração de TCC formatado em tabela Markdown. Distribui as etapas ao longo de meses. Número de meses disponíveis e tema: ' },
  { id: 'reviewer',     name: 'Revisor Crítico',          icon: <MessageCircleWarning className="w-5 h-5"/>,color: 'text-red-500',     bg: 'bg-red-500/10',     prompt: 'Avalia como banca examinadora: **Clareza**, **Rigor Científico**, **Conformidade ABNT**, **Qualidade do Argumento**. Aponta problemas e sugere correções. Texto: ' },
  { id: 'abstract',     name: 'Resumo e Abstract',        icon: <Languages className="w-5 h-5"/>,          color: 'text-pink-500',    bg: 'bg-pink-500/10',    prompt: 'Gera RESUMO em Português (250 palavras) e ABSTRACT em Inglês conforme ABNT NBR 6028. Objetivos, metodologia, resultados, conclusão, 5 palavras-chave. Texto base: ' },
  { id: 'bibliography', name: 'Fontes e Citações',        icon: <BookMarked className="w-5 h-5"/>,         color: 'text-emerald-500', bg: 'bg-emerald-500/10', prompt: 'Sugere 8 referências bibliográficas REAIS (livros, artigos, dissertações) em ABNT NBR 6023. Para cada: autor, ano, título, relevância. Assunto: ' },
  { id: 'references',   name: 'Referências ABNT',         icon: <Quote className="w-5 h-5"/>,             color: 'text-amber-500',   bg: 'bg-amber-500/10',   prompt: 'Formata em ABNT NBR 6023 (2018). Ordena alfabeticamente com todos os padrões de formatação. Dados: ' },
];

const TONES = [
  { id: 'formal',   label: 'Formal',    desc: 'Académico clássico' },
  { id: 'technical',label: 'Técnico',   desc: 'Preciso e direto' },
  { id: 'detailed', label: 'Detalhado', desc: 'Extenso e completo' },
  { id: 'concise',  label: 'Conciso',   desc: 'Objetivo e breve' },
];

const WORD_TARGETS = [200, 400, 600, 800, 1200];


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

  // New feature states
  const [tone, setTone] = useState('formal');
  const [wordTarget, setWordTarget] = useState(400);
  const [chatMessages, setChatMessages] = useState([]);
  const [followUpInput, setFollowUpInput] = useState('');
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);
  const resultRef = useRef(null);

  const [timer, setTimer] = useState(25 * 60);
  const [timerActive, setTimerActive] = useState(false);
  const [zenMode, setZenMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [historySearch, setHistorySearch] = useState('');
  const [savedAt, setSavedAt] = useState(null);
  const wordCount = useMemo(() => result ? result.split(/\s+/).filter(Boolean).length : 0, [result]);

  // RPG System
  const rpg = useMemo(() => {
    let xp = (generations.length * 50) + (tasks.filter(t=>t.done).length * 100) + (Object.values(chapterStatus).filter(Boolean).length * 500) + Math.floor(totalWords / 5);
    const titulos = ["Calouro TCC", "Explorador de Dados", "Pesquisador Focado", "Revisor ABNT", "Mestre da Bibliografia", "Escritor Incansável", "Especialista ABNT", "Doutor da Madrugada", "Lenda Acadêmica", "Patrono do Vasco"];
    const level = Math.floor(xp / 1000) + 1;
    const title = titulos[Math.min(level - 1, titulos.length - 1)];
    const progress = (xp % 1000) / 10;
    return { level, title, xp, progress };
  }, [generations, tasks, chapterStatus, totalWords]);

  const toggleRecording = () => {
    if (isRecording) {
      if(recognitionRef.current) recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Seu navegador não suporta gravação de voz. Tente usar o Google Chrome!");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += transcript + ' ';
      }
      if(finalTranscript) setInput(prev => prev + (prev.endsWith(' ') ? '' : ' ') + finalTranscript);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
    
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

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
  const totalWords = useMemo(() => projGen.reduce((acc, g) => acc + (g.output || '').split(/\s+/).filter(Boolean).length, 0), [projGen]);
  const isChapterDone = (ch) => chapterStatus[`${activeProjectId}-${ch}`];
  const completedChapters = CHAPTERS.filter(ch => isChapterDone(ch)).length;

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

  // --- STREAMING AI CALL ---
  const streamAI = async (messages, onChunk) => {
    const res = await fetch(STREAM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: messages,
        generationConfig: { temperature: tone === 'concise' ? 0.4 : tone === 'detailed' ? 0.9 : 0.7, maxOutputTokens: 8192 }
      })
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `HTTP ${res.status}`); }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value).split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const json = JSON.parse(line.slice(6));
          const chunk = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (chunk) { full += chunk; onChunk(full); }
        } catch {}
      }
    }
    return full;
  };

  const buildSys = () => {
    const toneMap = { formal: 'tom formal e académico', technical: 'tom técnico e preciso', detailed: 'tom detalhado e extenso', concise: 'tom conciso e direto' };
    return `És o TCC Master Pro, especialista em pesquisa académica brasileira. Projeto: "${project?.title || 'TCC'}". Usa ${toneMap[tone] || 'tom formal'}. Escreve aproximadamente ${wordTarget} palavras quando aplicável. ABNT sempre. Português do Brasil.`;
  };

  const callAI = async () => {
    if (!input.trim()) return;
    if (!activeProjectId) { setError('Cria ou seleciona um projeto primeiro!'); return; }
    setLoading(true); setError(null); setResult(''); setChatMessages([]);
    const userPrompt = tool ? `${tool.prompt}${input}` : input;
    const messages = [
      { role: 'user', parts: [{ text: buildSys() + '\n\n' + userPrompt }] }
    ];
    try {
      const out = await streamAI(messages, (partial) => {
        setResult(partial);
        if (resultRef.current) resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      });
      setChatMessages([{ role: 'user', parts: [{ text: userPrompt }] }, { role: 'model', parts: [{ text: out }] }]);
      const genId = Date.now()+'';
      await setDoc(doc(db, 'users', USER_ID, 'generations', genId), {
        pid: activeProjectId, toolId: activeTab,
        toolName: tool?.name || 'Chat', input, output: out, at: Date.now()
      });
      setSavedAt(new Date());
    } catch (e) { setError(`Erro: ${e.message}`);
    } finally { setLoading(false); }
  };

  const regenerate = async () => {
    if (!input.trim() || !activeProjectId) return;
    setLoading(true); setError(null); setResult(''); setChatMessages([]);
    const userPrompt = (tool ? `${tool.prompt}${input}` : input) + ' (Gera uma versão diferente e complementar da anterior.)';
    try {
      const out = await streamAI([{ role: 'user', parts: [{ text: buildSys() + '\n\n' + userPrompt }] }], setResult);
      setChatMessages([{ role: 'user', parts: [{ text: userPrompt }] }, { role: 'model', parts: [{ text: out }] }]);
      const genId = Date.now()+'';
      await setDoc(doc(db, 'users', USER_ID, 'generations', genId), {
        pid: activeProjectId, toolId: activeTab,
        toolName: tool?.name || 'Chat', input, output: out, at: Date.now()
      });
      setSavedAt(new Date());
    } catch (e) { setError(`Erro: ${e.message}`);
    } finally { setLoading(false); }
  };

  const sendFollowUp = async () => {
    if (!followUpInput.trim() || !result) return;
    setFollowUpLoading(true);
    const newMessages = [...chatMessages, { role: 'user', parts: [{ text: followUpInput }] }];
    const userQ = followUpInput;
    setFollowUpInput('');
    try {
      const msgWithSys = [{ role: 'user', parts: [{ text: buildSys() }] }, { role: 'model', parts: [{ text: 'Entendido. Estou pronto para ajudar com o seu TCC.' }] }, ...newMessages];
      let answer = '';
      await streamAI(msgWithSys, (partial) => { answer = partial; });
      setChatMessages([...newMessages, { role: 'model', parts: [{ text: answer }] }]);
    } catch (e) { setError(`Erro no follow-up: ${e.message}`);
    } finally { setFollowUpLoading(false); }
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
    const isNowDone = !chapterStatus[key];
    const updated = { ...chapterStatus, [key]: isNowDone };
    setChapterStatus(updated);
    await setDoc(doc(db, 'users', USER_ID, 'config', 'main'),
      { chapterStatus: updated, notes }, { merge: true });
    setSavedAt(new Date());

    if (isNowDone) {
      confetti({
        particleCount: 150,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#4ade80', '#3b82f6', '#facc15']
      });
    }
  };
  const updateNote = async (val) => {
    const updated = { ...notes, [activeProjectId]: val };
    setNotes(updated);
    await setDoc(doc(db, 'users', USER_ID, 'config', 'main'),
      { notes: updated, chapterStatus }, { merge: true });
    setSavedAt(new Date());
  };


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
            <img src="https://logodetimes.com/times/vasco-da-gama/logo-vasco-da-gama-256.png" alt="Vasco da Gama" className="w-10 h-10 object-contain drop-shadow-md hover:scale-105 transition-transform" />
            <div className="flex flex-col">
              <h1 className="font-black text-lg tracking-tight leading-none text-slate-800 dark:text-white">TCC <span className="text-indigo-500">Master</span></h1>
              <div className="mt-1 flex flex-col items-start gap-1">
                <p className="text-xs text-slate-500 font-medium tracking-wide">Marcio de Souza</p>
                <div title={`XP: ${rpg.xp}`} className="flex items-center gap-1.5 bg-gradient-to-r from-amber-100 to-amber-50 dark:from-amber-900/40 dark:to-orange-900/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-900/50 shadow-sm cursor-help hover:scale-105 transition-all w-max">
                  <Trophy className="w-3 h-3 text-amber-500"/>
                  <span className="text-[9px] font-black tracking-widest uppercase">Nvl {rpg.level} · {rpg.title}</span>
                </div>
              </div>
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
              <div className="flex items-center gap-1">
                <button title="Modo Foco Zen" onClick={() => setZenMode(!zenMode)} className={`p-2 rounded-xl text-xs transition-all ${zenMode ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                  <Scissors className="w-4 h-4" />
                </button>
                <button onClick={() => setTimerActive(!timerActive)} className={`p-2 rounded-xl text-white text-xs ${timerActive ? 'bg-red-500' : 'bg-orange-500'}`}>
                  {timerActive ? <Pause className="w-4 h-4"/> : <Play className="w-4 h-4"/>}
                </button>
              </div>
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
      <main className={`flex-1 flex flex-col min-w-0 transition-opacity duration-500 ${zenMode ? 'zen-blur-bg' : ''}`}>

        {/* Header */}
        <header className={`h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl flex items-center px-6 gap-4 sticky top-0 z-30 transition-all ${zenMode ? 'opacity-20 hover:opacity-100' : ''}`}>
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
            <button onClick={() => setShowHelp(true)} className="p-2 rounded-xl text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all">
              <HelpCircle className="w-5 h-5"/>
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
                    <p className="text-indigo-100 max-w-sm mb-6 text-sm leading-relaxed flex flex-col gap-2">
                      <span>Escreva, revise e organize o seu Trabalho com Inteligência Artificial avançada.</span>
                      <span className="text-yellow-300 font-bold flex items-center gap-1"><Sparkles className="w-3 h-3"/> {MOTIVATION[Math.floor(Math.random() * MOTIVATION.length)]}</span>
                    </p>
                    <div className="flex gap-3 flex-wrap">
                      <button onClick={() => { setActiveTab(TOOLS[0].id); setTool(TOOLS[0]); }} className="bg-white text-indigo-700 px-5 py-2.5 rounded-xl font-black text-sm hover:scale-105 transition-all shadow-xl">Começar a Escrever</button>
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
                            const isNowDone = !t.done;
                            await setDoc(doc(db, 'users', USER_ID, 'tasks', t.id), { ...t, done: isNowDone });
                            setSavedAt(new Date());
                            if (isNowDone) confetti({ particleCount: 70, spread: 60, origin: { y: 0.8 }, colors: ['#22c55e'] });
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
                  {TOOLS.slice(0, 9).map(t => (
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
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5"><Sliders className="w-3 h-3"/> Tom de Escrita</label>
                        <select value={tone} onChange={e=>setTone(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:border-indigo-500 transition-all">
                          {TONES.map(t=><option key={t.id} value={t.id}>{t.label} - {t.desc}</option>)}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5"><Target className="w-3 h-3"/> Extensão Média</label>
                        <select value={wordTarget} onChange={e=>setWordTarget(Number(e.target.value))} className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:border-indigo-500 transition-all">
                          {WORD_TARGETS.map(w=><option key={w} value={w}>~{w} palavras</option>)}
                        </select>
                      </div>
                    </div>
                    <textarea
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => { if (e.ctrlKey && e.key === 'Enter') callAI(); }}
                      placeholder="Descreve o assunto, tópico ou cole o texto para análise... (Ctrl+Enter para gerar)"
                      className="w-full min-h-36 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y text-sm leading-relaxed dark:text-white"
                    />
                    {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-400 font-medium">{error}</div>}
                    <div className="flex gap-2 relative z-10">
                      <button
                        onClick={toggleRecording}
                        className={`p-3.5 rounded-xl transition-all shadow-md flex items-center justify-center ${isRecording ? 'bg-red-500 text-white animate-pulse shadow-red-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                        title="Ditar ideia (Voz para Texto)"
                      >
                        {isRecording ? <MicOff className="w-5 h-5"/> : <Mic className="w-5 h-5"/>}
                      </button>
                      <button
                        disabled={loading || (!input.trim() && !isRecording)}
                        onClick={callAI}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white py-3.5 rounded-xl font-black flex items-center justify-center gap-3 transition-all shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:scale-[1.01] active:scale-[0.99]"
                      >
                        {loading ? <><Loader2 className="w-5 h-5 animate-spin"/> Mágica a acontecer...</> : <><Sparkles className="w-5 h-5"/> {isRecording ? 'Escutando... Clica para Parar e Gerar' : 'Gerar com IA Académica'}</>}
                      </button>
                    </div>
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
                      <div className="space-y-4 mb-6 max-h-[60vh] overflow-y-auto pr-2">
                         {chatMessages.length > 0 ? chatMessages.map((msg, i) => (
                           <div key={i} className={`p-5 rounded-2xl ${msg.role === 'user' ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 ml-8' : 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 mr-8 shadow-sm'}`}>
                             <p className="font-black text-[10px] uppercase tracking-widest mb-3 flex items-center gap-2 opacity-60">
                               {msg.role === 'user' ? <><span className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center text-white text-[8px]">VC</span> Você</> : <><Sparkles className="w-3 h-3"/> TCC Master Pro</>}
                             </p>
                             <div className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.parts[0].text) }} />
                           </div>
                         )) : (
                           <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm mr-8">
                             <p className="font-black text-[10px] uppercase tracking-widest mb-3 flex items-center gap-2 opacity-60">
                               <Sparkles className="w-3 h-3"/> TCC Master Pro
                             </p>
                             <div className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(result) }} />
                           </div>
                         )}
                         <div ref={resultRef} />
                      </div>
                      
                      {/* Follow-up input */}
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input type="text" value={followUpInput} onChange={e=>setFollowUpInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter') sendFollowUp()}} disabled={followUpLoading || loading} placeholder="Pedir alteração, continuação ou tirar dúvida..." className="w-full p-3.5 pr-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                          <button onClick={sendFollowUp} disabled={followUpLoading || loading || !followUpInput.trim()} className="absolute right-2 top-2 bottom-2 bg-indigo-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white w-10 flex items-center justify-center rounded-lg transition-all hover:bg-indigo-700">
                             {followUpLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
                          </button>
                        </div>
                        <button onClick={regenerate} disabled={loading || followUpLoading} className="bg-orange-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500 text-white px-5 rounded-xl hover:bg-orange-600 transition-all flex items-center gap-2 text-sm font-black shadow-lg shadow-orange-500/20">
                          {loading && !followUpLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <RotateCcw className="w-4 h-4"/>} Refazer
                        </button>
                      </div>
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

      {/* HELP MODAL */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-black flex items-center gap-2"><HelpCircle className="w-5 h-5 text-indigo-500"/> Ajuda & Guia Completo</h3>
              <button onClick={() => setShowHelp(false)} className="text-slate-400 hover:text-red-500 p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex items-center justify-center">
                <span className="font-bold text-lg leading-none">✕</span>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-8">
              
              <section>
                <h4 className="font-black text-sm text-slate-800 dark:text-white mb-3 flex items-center gap-2 uppercase tracking-wide"><Layout className="w-4 h-4 text-indigo-500"/> Menu Principal</h4>
                <div className="space-y-3">
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
                    <p className="font-bold text-sm text-indigo-600 dark:text-indigo-400 mb-1">Dashboard (Início) & RPG</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Visão geral do teu projeto. Ganhe <strong>XP e suba de Nível (RPG)</strong> ao completar Tarefas, marcar Capítulos como feitos e gerar palavras! Assista aos confetes em cada vitória.</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
                    <p className="font-bold text-sm text-indigo-600 dark:text-indigo-400 mb-1">Notas do Projeto</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Um bloco de notas livre. Ideal para colar feedbacks do orientador, links úteis e ideias soltas que não deves perder.</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
                    <p className="font-bold text-sm text-indigo-600 dark:text-indigo-400 mb-1">Progresso & Compilador</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">O <strong>Progresso</strong> permite "dar o check" em cada capítulo terminado. O <strong>Compilador</strong> junta tudo o que já geraste com a IA num único documento.</p>
                  </div>
                </div>
              </section>

              <section>
                <h4 className="font-black text-sm text-slate-800 dark:text-white mb-3 flex items-center gap-2 uppercase tracking-wide"><Sparkles className="w-4 h-4 text-indigo-500"/> Escrita Inteligente & Ditado por Voz</h4>
                <div className="space-y-3">
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
                    <p className="font-bold text-sm text-indigo-600 dark:text-indigo-400 mb-1">1. Tom e Extensão</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Antes de gerar, escolha se prefere um texto <strong>Formal, Dinâmico, Detalhado ou Conciso</strong>. A IA adapta o vocabulário e o limite de palavras.</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
                    <p className="font-bold text-sm text-indigo-600 dark:text-indigo-400 mb-1">2. Ditado por Voz (Microfone)</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Cansado de digitar? Ao lado do botão de gerar, há um ícone de <strong>Microfone</strong>. Clique, fale sua ideia de forma bruta falada, e ela vai pra caixa de texto. A IA transformará a sua voz em ABNT perfeito.</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
                    <p className="font-bold text-sm text-indigo-600 dark:text-indigo-400 mb-1">3. Chat de Follow-Up</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Se o trecho ficou quase perfeito, desça a tela e use o Chat para instruir: <em>"Substitua a palavra X", "Reescreva mais formal"</em>.</p>
                  </div>
                </div>
              </section>

              <section>
                <h4 className="font-black text-sm text-slate-800 dark:text-white mb-3 flex items-center gap-2 uppercase tracking-wide"><PenTool className="w-4 h-4 text-indigo-500"/> As 16 Ferramentas de TCC</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl"><p className="font-bold text-xs text-slate-800 dark:text-slate-200">Pesquisa Geral</p><p className="text-[10px] text-slate-500 mt-1">Busque autores, citações ou teorias em formato ABNT.</p></div>
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl"><p className="font-bold text-xs text-slate-800 dark:text-slate-200">Problema de Pesquisa</p><p className="text-[10px] text-slate-500 mt-1">Ajuda a definir e lapidar qual é o problema central da sua tese.</p></div>
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl"><p className="font-bold text-xs text-slate-800 dark:text-slate-200">Hipótese e Objetivos</p><p className="text-[10px] text-slate-500 mt-1">Escreve o Objetivo Geral e Específicos do seu projeto.</p></div>
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl"><p className="font-bold text-xs text-slate-800 dark:text-slate-200">Escrever Introdução</p><p className="text-[10px] text-slate-500 mt-1">Estrutura o início do TCC apresentando o tema e a relevância.</p></div>
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl"><p className="font-bold text-xs text-slate-800 dark:text-slate-200">Estruturar Capítulo</p><p className="text-[10px] text-slate-500 mt-1">Cria o desenvolvimento de um capítulo com referências.</p></div>
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl"><p className="font-bold text-xs text-slate-800 dark:text-slate-200">Escrever Conclusão</p><p className="text-[10px] text-slate-500 mt-1">Sintetiza os resultados da pesquisa fechando o trabalho.</p></div>
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl"><p className="font-bold text-xs text-slate-800 dark:text-slate-200">Paráfrase Anti-Plágio</p><p className="text-[10px] text-slate-500 mt-1">Reescreve passagens externas sem perder o sentido original.</p></div>
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl"><p className="font-bold text-xs text-slate-800 dark:text-slate-200">Revisar Gramática</p><p className="text-[10px] text-slate-500 mt-1">Corrige erros ortográficos, concordância e repetições.</p></div>
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl"><p className="font-bold text-xs text-slate-800 dark:text-slate-200">Análise de Artigo</p><p className="text-[10px] text-slate-500 mt-1">Cole um texto longo e ela extrai os pontos e metodologia dele.</p></div>
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl"><p className="font-bold text-xs text-slate-800 dark:text-slate-200">Criar Questionário</p><p className="text-[10px] text-slate-500 mt-1">Gera perguntas prontas (múltipla escolha/abertas) pro Forms/Entrevista.</p></div>
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl"><p className="font-bold text-xs text-slate-800 dark:text-slate-200">Cronograma TCC</p><p className="text-[10px] text-slate-500 mt-1">Faz um passo a passo do que fazer em cada mês de projeto.</p></div>
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl"><p className="font-bold text-xs text-slate-800 dark:text-slate-200">Resumo e Abstract</p><p className="text-[10px] text-slate-500 mt-1">Escreve o Resumo ABNT de até 500 palavras e traduz pro inglês.</p></div>
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl"><p className="font-bold text-xs text-slate-800 dark:text-slate-200">Sugerir Bibliografia</p><p className="text-[10px] text-slate-500 mt-1">Mostra quais livros e autores mais famosos a consultar na sua área.</p></div>
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl"><p className="font-bold text-xs text-slate-800 dark:text-slate-200">Formatar Referências</p><p className="text-[10px] text-slate-500 mt-1">Transforma um link solto ou nome de livro no Padrão ABNT 6023.</p></div>
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl"><p className="font-bold text-xs text-slate-800 dark:text-slate-200">Citação Direta (Curta/Longa)</p><p className="text-[10px] text-slate-500 mt-1">Ensina como usar a regra das aspas ou recuo de 4cm no texto.</p></div>
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl"><p className="font-bold text-xs text-slate-800 dark:text-slate-200">Citação Indireta</p><p className="text-[10px] text-slate-500 mt-1">Explica como incluir o (AUTOR, ANO) quando usa as suas próprias palavras.</p></div>
                </div>
              </section>

              <section>
                <h4 className="font-black text-sm text-slate-800 dark:text-white mb-3 flex items-center gap-2 uppercase tracking-wide"><Timer className="w-4 h-4 text-indigo-500"/> Pomodoro & Modo Zen (Foco)</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 p-4 rounded-xl leading-relaxed">
                  No canto inferior esquerdo, há um cronómetro Pomodoro (25min de foco / 5min de pausa). <br/>
                  <strong>🚀 Super Dica (Modo Zen):</strong> Ao lado do botão Play, existe o ícone da <strong>Tesoura</strong>. Ao clicar nele, você remove todas as distrações da tela (barra lateral, topo). Foque 100% apenas em ler os resultados do robô e compilar o seu texto!
                </p>
              </section>

            </div>
            
            <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
              <button onClick={() => setShowHelp(false)} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black transition-all shadow-lg shadow-indigo-500/20">
                Pronto, entendi! Vamos ao TCC 🚀
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
