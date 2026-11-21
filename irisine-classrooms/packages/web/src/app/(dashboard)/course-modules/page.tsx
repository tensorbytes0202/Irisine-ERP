'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Layers,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  Lock,
  Unlock,
  CheckCircle,
  Circle,
  Clock,
  FileText,
  Video,
  Link as LinkIcon,
  BookOpen,
  MessageSquare,
  HelpCircle,
  Eye,
  BarChart2,
  GripVertical,
} from 'lucide-react';

interface ClassOption { id: string; name: string; }
interface SubjectOption { id: string; name: string; code: string; }

interface ModuleItem {
  id: string;
  title: string;
  type: string;
  contentUrl?: string;
  description?: string;
  orderIndex: number;
  isRequired: boolean;
  estimatedMinutes?: number;
  completions?: { status: string; score?: number }[];
}

interface CourseModule {
  id: string;
  title: string;
  description?: string;
  classId: string;
  subjectId: string;
  orderIndex: number;
  isPublished: boolean;
  unlockType: string;
  unlockDate?: string;
  prerequisiteModuleId?: string;
  completionCriteria: string;
  minimumScore?: number;
  estimatedMinutes?: number;
  items: ModuleItem[];
  completionStats?: { total: number; completed: number; percentage: number };
}

const ITEM_TYPES = ['CONTENT', 'ASSIGNMENT', 'QUIZ', 'DISCUSSION', 'VIDEO', 'DOCUMENT', 'LINK', 'PAGE'];

const typeIcon: Record<string, any> = {
  CONTENT: BookOpen,
  ASSIGNMENT: FileText,
  QUIZ: HelpCircle,
  DISCUSSION: MessageSquare,
  VIDEO: Video,
  DOCUMENT: FileText,
  LINK: LinkIcon,
  PAGE: Eye,
};

const typeColors: Record<string, string> = {
  CONTENT: 'bg-primary/10 text-primary',
  ASSIGNMENT: 'bg-orange-100 text-orange-700',
  QUIZ: 'bg-primary/10 text-primary',
  DISCUSSION: 'bg-green-100 text-green-700',
  VIDEO: 'bg-red-100 text-red-700',
  DOCUMENT: 'bg-muted text-foreground/80',
  LINK: 'bg-cyan-100 text-cyan-700',
  PAGE: 'bg-yellow-100 text-yellow-700',
};

const unlockLabels: Record<string, string> = {
  ALWAYS: 'Always Available',
  SEQUENTIAL: 'Sequential Unlock',
  DATE: 'Date Unlock',
  PREREQUISITE: 'Prerequisite',
};

export default function CourseModulesPage() {
  const base = process.env.NEXT_PUBLIC_API_URL;
  const token = () => (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '');
  const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` });

  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    unlockType: 'ALWAYS',
    unlockDate: '',
    completionCriteria: 'VIEW_ALL',
    minimumScore: '',
    estimatedMinutes: '',
    items: [] as Array<{ title: string; type: string; contentUrl: string; description: string; isRequired: boolean; estimatedMinutes: string }>,
  });

  useEffect(() => {
    fetch('/api/v1/classes', { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        setClasses(Array.isArray(data) ? data : []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedClassId) { setSubjects([]); return; }
    fetch(`/api/v1/subjects?classId=${selectedClassId}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setSubjects(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [selectedClassId]);

  const fetchModules = useCallback(() => {
    if (!selectedClassId || !selectedSubjectId) return;
    setLoading(true);
    fetch(`${base}/course-modules?classId=${selectedClassId}&subjectId=${selectedSubjectId}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setModules(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedClassId, selectedSubjectId]);

  useEffect(() => { fetchModules(); }, [fetchModules]);

  const addItem = () => {
    setForm((f) => ({
      ...f,
      items: [...f.items, { title: '', type: 'CONTENT', contentUrl: '', description: '', isRequired: true, estimatedMinutes: '' }],
    }));
  };

  const removeItem = (index: number) => {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== index) }));
  };

  const updateItem = (index: number, field: string, value: any) => {
    setForm((f) => ({
      ...f,
      items: f.items.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title: form.title,
      description: form.description,
      classId: selectedClassId,
      subjectId: selectedSubjectId,
      unlockType: form.unlockType,
      unlockDate: form.unlockDate || undefined,
      completionCriteria: form.completionCriteria,
      minimumScore: form.minimumScore ? parseFloat(form.minimumScore) : undefined,
      estimatedMinutes: form.estimatedMinutes ? parseInt(form.estimatedMinutes) : undefined,
      items: form.items.map((item, i) => ({
        title: item.title,
        type: item.type,
        contentUrl: item.contentUrl || undefined,
        description: item.description || undefined,
        isRequired: item.isRequired,
        estimatedMinutes: item.estimatedMinutes ? parseInt(item.estimatedMinutes) : undefined,
        orderIndex: i + 1,
      })),
    };

    try {
      const res = await fetch(`${base}/course-modules`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setShowCreateForm(false);
        setForm({ title: '', description: '', unlockType: 'ALWAYS', unlockDate: '', completionCriteria: 'VIEW_ALL', minimumScore: '', estimatedMinutes: '', items: [] });
        fetchModules();
      }
    } catch {}
  };

  const togglePublish = async (mod: CourseModule) => {
    setPublishing(mod.id);
    try {
      await fetch(`${base}/course-modules/${mod.id}/publish`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ isPublished: !mod.isPublished }),
      });
      fetchModules();
    } finally { setPublishing(null); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Layers className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Course Modules</h1>
            <p className="text-sm text-muted-foreground">Structured learning paths with sequential unlock</p>
          </div>
        </div>
        {selectedClassId && selectedSubjectId && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" /> Create Module
          </button>
        )}
      </div>

      {/* Class / Subject Selectors */}
      <div className="flex gap-4 flex-wrap">
        <select
          value={selectedClassId}
          onChange={(e) => { setSelectedClassId(e.target.value); setSelectedSubjectId(''); }}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Select Class</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={selectedSubjectId}
          onChange={(e) => setSelectedSubjectId(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
          disabled={!selectedClassId}
        >
          <option value="">Select Subject</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Modules List */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : !selectedClassId || !selectedSubjectId ? (
        <div className="text-center py-16 text-muted-foreground">
          <Layers className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg">Select a class and subject to view modules</p>
        </div>
      ) : modules.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Layers className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg">No modules yet. Create your first module!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {modules.map((mod) => {
            const isExpanded = expandedModuleId === mod.id;
            const stats = mod.completionStats;
            return (
              <div key={mod.id} className="bg-card border rounded-xl shadow-sm overflow-hidden">
                {/* Module Header */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50"
                  onClick={() => setExpandedModuleId(isExpanded ? null : mod.id)}
                >
                  <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="w-7 h-7 bg-primary/10 text-primary text-xs font-bold rounded-full flex items-center justify-center">
                      {mod.orderIndex}
                    </span>
                    {mod.unlockType !== 'ALWAYS' ? (
                      <Lock className="w-4 h-4 text-amber-500" />
                    ) : (
                      <Unlock className="w-4 h-4 text-green-500" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">{mod.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${mod.isPublished ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                        {mod.isPublished ? 'Published' : 'Draft'}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/5 text-primary">
                        {unlockLabels[mod.unlockType] || mod.unlockType}
                      </span>
                    </div>
                    {mod.description && <p className="text-sm text-muted-foreground mt-0.5 truncate">{mod.description}</p>}

                    {/* Progress bar */}
                    {stats && (
                      <div className="mt-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-muted rounded-full h-1.5">
                            <div
                              className="bg-primary h-1.5 rounded-full transition-all"
                              style={{ width: `${stats.percentage}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{stats.completed}/{stats.total}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    {mod.estimatedMinutes && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        {mod.estimatedMinutes}m
                      </div>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); togglePublish(mod); }}
                      disabled={publishing === mod.id}
                      className={`text-xs px-3 py-1 rounded-full border transition-colors ${mod.isPublished ? 'border-red-300 text-red-600 hover:bg-red-50' : 'border-green-300 text-green-600 hover:bg-green-50'}`}
                    >
                      {publishing === mod.id ? '...' : mod.isPublished ? 'Unpublish' : 'Publish'}
                    </button>
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {/* Module Items */}
                {isExpanded && (
                  <div className="border-t bg-muted/50">
                    {mod.items.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">No items in this module</p>
                    ) : (
                      <div className="divide-y">
                        {mod.items.map((item) => {
                          const Icon = typeIcon[item.type] || FileText;
                          const isCompleted = (item.completions ?? []).some((c) => c.status === 'COMPLETED');
                          return (
                            <div key={item.id} className="flex items-center gap-3 px-6 py-3 hover:bg-card transition-colors">
                              {isCompleted ? (
                                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                              ) : (
                                <Circle className="w-5 h-5 text-gray-300 flex-shrink-0" />
                              )}
                              <div className={`p-1.5 rounded-lg ${typeColors[item.type] || 'bg-muted text-muted-foreground'}`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium text-foreground">{item.title}</span>
                                {item.description && <p className="text-xs text-muted-foreground truncate">{item.description}</p>}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {!item.isRequired && <span className="text-xs text-muted-foreground">Optional</span>}
                                {item.estimatedMinutes && (
                                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Clock className="w-3 h-3" /> {item.estimatedMinutes}m
                                  </span>
                                )}
                                <span className={`text-xs px-2 py-0.5 rounded-full ${typeColors[item.type] || 'bg-muted text-muted-foreground'}`}>
                                  {item.type}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Module Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl my-4">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-foreground">Create Module</h2>
              <button onClick={() => setShowCreateForm(false)} className="p-2 hover:bg-muted rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-1">Title *</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="Module title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Module description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1">Unlock Type</label>
                  <select
                    value={form.unlockType}
                    onChange={(e) => setForm((f) => ({ ...f, unlockType: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="ALWAYS">Always Available</option>
                    <option value="SEQUENTIAL">Sequential</option>
                    <option value="DATE">Date-based</option>
                    <option value="PREREQUISITE">Prerequisite</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1">Completion Criteria</label>
                  <select
                    value={form.completionCriteria}
                    onChange={(e) => setForm((f) => ({ ...f, completionCriteria: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="VIEW_ALL">View All Items</option>
                    <option value="SCORE_MINIMUM">Minimum Score</option>
                    <option value="MANUAL">Manual</option>
                  </select>
                </div>
              </div>
              {form.unlockType === 'DATE' && (
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1">Unlock Date</label>
                  <input
                    type="datetime-local"
                    value={form.unlockDate}
                    onChange={(e) => setForm((f) => ({ ...f, unlockDate: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              )}
              {form.completionCriteria === 'SCORE_MINIMUM' && (
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1">Minimum Score (%)</label>
                  <input
                    type="number"
                    min="0" max="100"
                    value={form.minimumScore}
                    onChange={(e) => setForm((f) => ({ ...f, minimumScore: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="e.g. 70"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-1">Estimated Minutes</label>
                <input
                  type="number"
                  value={form.estimatedMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, estimatedMinutes: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="e.g. 45"
                />
              </div>

              {/* Items Builder */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-foreground/80">Module Items</label>
                  <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80">
                    <Plus className="w-3.5 h-3.5" /> Add Item
                  </button>
                </div>
                <div className="space-y-3">
                  {form.items.map((item, index) => (
                    <div key={index} className="border rounded-lg p-3 bg-muted/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground">Item {index + 1}</span>
                        <button type="button" onClick={() => removeItem(index)} className="text-red-400 hover:text-red-600">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          value={item.title}
                          onChange={(e) => updateItem(index, 'title', e.target.value)}
                          placeholder="Item title"
                          className="border rounded-lg px-2 py-1.5 text-sm col-span-2"
                        />
                        <select
                          value={item.type}
                          onChange={(e) => updateItem(index, 'type', e.target.value)}
                          className="border rounded-lg px-2 py-1.5 text-sm"
                        >
                          {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <input
                          type="number"
                          value={item.estimatedMinutes}
                          onChange={(e) => updateItem(index, 'estimatedMinutes', e.target.value)}
                          placeholder="Minutes"
                          className="border rounded-lg px-2 py-1.5 text-sm"
                        />
                        <input
                          value={item.contentUrl}
                          onChange={(e) => updateItem(index, 'contentUrl', e.target.value)}
                          placeholder="Content URL (optional)"
                          className="border rounded-lg px-2 py-1.5 text-sm col-span-2"
                        />
                        <label className="flex items-center gap-2 text-sm text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={item.isRequired}
                            onChange={(e) => updateItem(index, 'isRequired', e.target.checked)}
                          />
                          Required
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateForm(false)} className="flex-1 border rounded-lg py-2 text-sm hover:bg-muted/50">
                  Cancel
                </button>
                <button type="submit" className="flex-1 bg-primary text-white rounded-lg py-2 text-sm hover:bg-primary/90">
                  Create Module
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
