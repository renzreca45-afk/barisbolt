import { useEffect, useState, useRef } from 'react';
import {
  FileText,
  Search,
  Plus,
  Pencil,
  Printer,
  Download,
  ArrowLeft,
  Loader2,
  Eye,
  Settings,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { DocumentType, DocumentTemplate, Resident, TemplateElement, TemplatePageSettings } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { useBarangay } from '@/contexts/BarangayContext';
import { navigate } from '@/lib/router';
import { calculateAge, getFullName, formatDate } from '@/lib/age';
import { logAudit } from '@/lib/audit';
import { PAGE_DIMENSIONS } from '@/lib/constants';
import { PageHeader, Badge, EmptyState, Modal } from '@/components/ui';
import { ResidentAvatar } from '@/components/ResidentShared';

export function Documents({ routeParams }: { routeParams: Record<string, string> }) {
  if (routeParams.id === 'new' || (routeParams.id && routeParams.id !== 'editor')) {
    return <DocumentGenerator residentId={routeParams.residentId} />;
  }
  if (routeParams.id === 'editor') {
    return <TemplateEditor templateId={routeParams.templateId} />;
  }
  return <DocumentTypeList />;
}

// ============================================================================
// DOCUMENT TYPE LIST
// ============================================================================
function DocumentTypeList() {
  const { canEdit } = useAuth();
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const { data: dt } = await supabase.from('document_types').select('*').eq('is_active', true).order('display_order');
    if (dt) setDocTypes(dt as DocumentType[]);
    const { data: tm } = await supabase.from('document_templates').select('*').eq('is_active', true);
    if (tm) setTemplates(tm as DocumentTemplate[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const startGeneration = (docTypeId: string) => {
    navigate('documents', { id: 'new', docType: docTypeId });
  };

  const openEditor = (templateId?: string) => {
    navigate('documents', { id: 'editor', templateId: templateId ?? 'new' });
  };

  if (loading) return <div className="p-6 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Documents"
        description="Generate certificates, clearances, and other barangay documents"
        actions={canEdit() && (
          <button className="btn-secondary" onClick={() => openEditor()}>
            <Settings className="h-4 w-4" /> Template Editor
          </button>
        )}
      />

      {docTypes.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={FileText}
            title="No document types configured"
            description="An administrator needs to add document types in Administration first."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {docTypes.map((dt) => {
            const template = templates.find((t) => t.document_type_id === dt.id);
            return (
              <div key={dt.id} className="card p-5 hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
                    <FileText className="h-6 w-6 text-blue-600" />
                  </div>
                  {template ? (
                    <Badge color="green">Template Ready</Badge>
                  ) : (
                    <Badge color="yellow">No Template</Badge>
                  )}
                </div>
                <h3 className="text-sm font-bold text-slate-800">{dt.name}</h3>
                <p className="text-xs text-slate-500 mt-1">{dt.description}</p>
                <div className="mt-4 flex items-center gap-2">
                  <button className="btn-primary flex-1" onClick={() => startGeneration(dt.id)}>
                    <Plus className="h-4 w-4" /> Generate
                  </button>
                  {canEdit() && (
                    <button className="btn-secondary" onClick={() => openEditor(template?.id)}>
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {dt.default_fee > 0 && (
                  <p className="mt-2 text-xs text-slate-400">Fee: ₱{dt.default_fee}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// DOCUMENT GENERATOR
// ============================================================================
function DocumentGenerator({ residentId }: { residentId?: string }) {
  const { profile: barangay } = useBarangay();
  const { canEdit, session } = useAuth();
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
  const [selectedDocType, setSelectedDocType] = useState<string>('');
  const [residents, setResidents] = useState<Resident[]>([]);
  const [residentSearch, setResidentSearch] = useState('');
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [purpose, setPurpose] = useState('');
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  const [showCustomFieldModal, setShowCustomFieldModal] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  const [generating, setGenerating] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);

  useEffect(() => {
    const fetchDocTypes = async () => {
      const { data } = await supabase.from('document_types').select('*').eq('is_active', true).order('display_order');
      if (data) setDocTypes(data as DocumentType[]);
    };
    fetchDocTypes();

    const fetchTemplates = async () => {
      const { data } = await supabase.from('document_templates').select('*').eq('is_active', true);
      if (data) setTemplates(data as DocumentTemplate[]);
    };
    fetchTemplates();

    if (residentId) {
      supabase.from('residents').select('*').eq('id', residentId).maybeSingle().then(({ data }) => {
        if (data) setSelectedResident(data as Resident);
      });
    }
  }, [residentId]);

  useEffect(() => {
    if (residentSearch.trim().length < 2) { setResidents([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('residents')
        .select('*')
        .or(`first_name.ilike.%${residentSearch}%,last_name.ilike.%${residentSearch}%`)
        .neq('verification_status', 'archived')
        .limit(10);
      if (data) setResidents(data as Resident[]);
    }, 300);
    return () => clearTimeout(timer);
  }, [residentSearch]);

  const template = templates.find((t) => t.document_type_id === selectedDocType);

  const resolveField = (field: string): string => {
    if (!selectedResident && !barangay) return '';
    const r = selectedResident;
    const map: Record<string, string> = {
      RESIDENT_NAME: r ? getFullName(r) : '',
      FIRST_NAME: r?.first_name ?? '',
      MIDDLE_NAME: r?.middle_name ?? '',
      LAST_NAME: r?.last_name ?? '',
      SUFFIX: r?.suffix ?? '',
      DOB: r ? formatDate(r.date_of_birth) : '',
      AGE: r ? String(calculateAge(r.date_of_birth) ?? '') : '',
      SEX: r?.sex ?? '',
      CIVIL_STATUS: r?.civil_status ?? '',
      ADDRESS: r?.complete_address ?? '',
      PUROK: r?.purok ?? '',
      VILLAGE: r?.village ?? '',
      HOUSEHOLD_ID: r?.household_id ?? '',
      HOUSEHOLD_HEAD: '',
      RELATIONSHIP: r?.relationship_to_head ?? '',
      PURPOSE: purpose,
      DATE: formatDate(new Date().toISOString()),
      BARANGAY_NAME: barangay?.barangay_name ?? '',
      CITY_MUNICIPALITY: barangay?.city_municipality ?? '',
      PROVINCE: barangay?.province ?? '',
      PUNONG_BARANGAY: barangay?.punong_barangay ?? '',
      ...customFields,
    };
    return map[field] ?? '';
  };

  const handleGenerate = async () => {
    setGenerating(true);
    const dt = docTypes.find((d) => d.id === selectedDocType);
    const { data: txn } = await supabase.from('transactions').insert({
      resident_id: selectedResident?.id ?? null,
      document_type_id: selectedDocType || null,
      template_id: template?.id ?? null,
      purpose,
      fee: dt?.default_fee ?? 0,
      status: 'released',
      processed_by: session?.user.id,
      resident_snapshot: selectedResident as unknown as Record<string, unknown>,
      custom_fields: customFields,
    }).select().maybeSingle();
    if (txn) {
      await logAudit('Document Generated', 'transaction', (txn as { id: string }).id, `Generated ${dt?.name} for ${selectedResident ? getFullName(selectedResident) : 'unregistered'}`);
    }
    setGenerating(false);
    setPreviewMode(true);
  };

  const handlePrint = () => {
    window.print();
  };

  if (previewMode) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4 no-print">
          <button className="btn-ghost" onClick={() => setPreviewMode(false)}>
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={handlePrint}>
              <Printer className="h-4 w-4" /> Print
            </button>
          </div>
        </div>

        <div className="print-area">
          {template ? (
            <TemplateRenderer template={template} resolveField={resolveField} barangay={barangay} />
          ) : (
            <SimpleDocumentPreview
              docTypeName={docTypes.find((d) => d.id === selectedDocType)?.name ?? 'Certificate'}
              resolveField={resolveField}
              barangay={barangay}
              customFields={customFields}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button className="btn-ghost mb-4" onClick={() => navigate('documents')}>
        <ArrowLeft className="h-4 w-4" /> Back to Documents
      </button>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Generate Document</h1>

      <div className="space-y-6">
        {/* Step 1: Select document type */}
        <div className="card p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-3">1. Select Document Type</h3>
          <select className="select" value={selectedDocType} onChange={(e) => setSelectedDocType(e.target.value)}>
            <option value="">Choose a document type...</option>
            {docTypes.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>

        {/* Step 2: Select resident */}
        <div className="card p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-3">2. Select Resident</h3>
          {selectedResident ? (
            <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-200">
              <div className="flex items-center gap-3">
                <ResidentAvatar r={selectedResident} />
                <div>
                  <p className="text-sm font-medium text-blue-900">{getFullName(selectedResident)}</p>
                  <p className="text-xs text-blue-700">{selectedResident.purok} {selectedResident.village}</p>
                </div>
              </div>
              <button className="text-blue-600 hover:text-blue-800" onClick={() => setSelectedResident(null)}>
                Change
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input className="input pl-10" placeholder="Search resident by name..." value={residentSearch} onChange={(e) => setResidentSearch(e.target.value)} />
              </div>
              {residents.length > 0 && (
                <div className="mt-2 border border-slate-200 rounded-lg max-h-60 overflow-y-auto">
                  {residents.map((r) => (
                    <button key={r.id} onClick={() => { setSelectedResident(r); setResidentSearch(''); setResidents([]); }} className="w-full flex items-center gap-3 p-2.5 hover:bg-slate-50 text-left">
                      <ResidentAvatar r={r} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{getFullName(r)}</p>
                        <p className="text-xs text-slate-500">{r.purok} {r.village}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-2 text-xs text-slate-400">
                Can't find the person? You can still generate a document without a resident profile — just leave this empty.
              </p>
            </>
          )}
        </div>

        {/* Step 3: Purpose and custom fields */}
        <div className="card p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-3">3. Document Information</h3>
          <div className="space-y-4">
            <div>
              <label className="label">Purpose</label>
              <input className="input" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g., Employment requirement, School enrollment" />
            </div>

            {Object.keys(customFields).length > 0 && (
              <div className="space-y-2">
                <label className="label">Custom Fields</label>
                {Object.entries(customFields).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-600 w-32 truncate">{key}:</span>
                    <span className="text-sm text-slate-800 flex-1">{value}</span>
                    <button className="text-red-500 text-xs" onClick={() => { const c = { ...customFields }; delete c[key]; setCustomFields(c); }}>Remove</button>
                  </div>
                ))}
              </div>
            )}

            <button className="btn-secondary" onClick={() => setShowCustomFieldModal(true)}>
              <Plus className="h-4 w-4" /> Add Custom Field
            </button>
          </div>
        </div>

        {/* Step 4: Generate */}
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={() => navigate('documents')}>Cancel</button>
          <button className="btn-primary" onClick={handleGenerate} disabled={!selectedDocType || generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            {generating ? 'Generating...' : 'Preview Document'}
          </button>
        </div>
      </div>

      <Modal open={showCustomFieldModal} onClose={() => setShowCustomFieldModal(false)} title="Add Custom Field" footer={
        <>
          <button className="btn-secondary" onClick={() => setShowCustomFieldModal(false)}>Cancel</button>
          <button className="btn-primary" onClick={() => {
            if (newFieldName.trim()) {
              setCustomFields({ ...customFields, [newFieldName.toUpperCase().replace(/\s/g, '_')]: newFieldValue });
              setNewFieldName(''); setNewFieldValue('');
              setShowCustomFieldModal(false);
            }
          }}>Add</button>
        </>
      }>
        <div className="space-y-4">
          <div><label className="label">Field Name</label><input className="input" value={newFieldName} onChange={(e) => setNewFieldName(e.target.value)} placeholder="e.g., Employer Name, School Name" /></div>
          <div><label className="label">Field Value</label><input className="input" value={newFieldValue} onChange={(e) => setNewFieldValue(e.target.value)} /></div>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================================
// TEMPLATE RENDERER (renders template JSON to HTML)
// ============================================================================
function TemplateRenderer({ template, resolveField, barangay }: { template: DocumentTemplate; resolveField: (f: string) => string; barangay: { barangay_name: string; punong_barangay: string; logo_url: string | null } | null }) {
  const { page, elements } = template.template_json;
  const dims = PAGE_DIMENSIONS[page.pageSize] ?? PAGE_DIMENSIONS.a4;
  const isLandscape = page.orientation === 'landscape';
  const width = isLandscape ? dims.height : dims.width;
  const height = isLandscape ? dims.width : dims.height;

  return (
    <div
      className="bg-white shadow-lg mx-auto relative"
      style={{
        width: `${width}px`,
        minHeight: `${height}px`,
        padding: `${page.marginTop || 40}px ${page.marginRight || 40}px ${page.marginBottom || 40}px ${page.marginLeft || 40}px`,
        background: page.background || '#ffffff',
      }}
    >
      {page.watermark && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ opacity: page.watermarkOpacity ?? 0.1 }}
        >
          <span className="text-6xl font-bold text-slate-300 rotate-[-30deg]">{page.watermark}</span>
        </div>
      )}
      {elements.sort((a, b) => a.zIndex - b.zIndex).map((el) => (
        <TemplateElementRender key={el.id} el={el} resolveField={resolveField} barangay={barangay} />
      ))}
    </div>
  );
}

function TemplateElementRender({ el, resolveField, barangay }: { el: TemplateElement; resolveField: (f: string) => string; barangay: { logo_url: string | null } | null }) {
  const content = el.field ? resolveField(el.field) : (el.content || '');

  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${el.x}px`,
    top: `${el.y}px`,
    width: `${el.width}px`,
    minHeight: `${el.height}px`,
    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
    zIndex: el.zIndex,
    opacity: el.opacity ?? 1,
  };

  if (el.type === 'image' || el.type === 'shape') {
    if (el.src) {
      return <img src={el.src} alt="" style={style} className="object-contain" />;
    }
    if (el.shape === 'rect' || !el.shape) {
      return <div style={{ ...style, background: el.fill || '#e0e0e0', border: el.stroke ? `${el.strokeWidth || 1}px solid ${el.stroke}` : undefined, borderRadius: el.borderRadius ?? 0 }} />;
    }
    if (el.shape === 'circle') {
      return <div style={{ ...style, background: el.fill || '#e0e0e0', borderRadius: '50%' }} />;
    }
    if (el.shape === 'line') {
      return <div style={{ ...style, height: `${el.strokeWidth || 1}px`, background: el.stroke || '#000' }} />;
    }
  }

  // Text element
  const textStyle: React.CSSProperties = {
    fontFamily: el.fontFamily || 'Times New Roman, serif',
    fontSize: `${el.fontSize || 12}pt`,
    fontWeight: el.bold ? 'bold' : 'normal',
    fontStyle: el.italic ? 'italic' : 'normal',
    textDecoration: el.underline ? 'underline' : 'none',
    color: el.color || '#000000',
    textAlign: el.align || 'left',
    lineHeight: el.lineHeight ?? 1.4,
    letterSpacing: el.letterSpacing ? `${el.letterSpacing}px` : undefined,
    whiteSpace: 'pre-wrap',
  };

  return <div style={style}><div style={textStyle}>{content}</div></div>;
}

// ============================================================================
// SIMPLE DOCUMENT PREVIEW (no template — basic certificate layout)
// ============================================================================
function SimpleDocumentPreview({ docTypeName, resolveField, barangay, customFields }: { docTypeName: string; resolveField: (f: string) => string; barangay: { barangay_name: string; city_municipality: string; province: string; punong_barangay: string; logo_url: string | null; complete_address: string } | null; customFields: Record<string, string> }) {
  return (
    <div className="bg-white shadow-lg mx-auto p-16" style={{ width: '612px', minHeight: '792px' }}>
      <div className="text-center mb-8">
        {barangay?.logo_url && <img src={barangay.logo_url} alt="Logo" className="h-24 mx-auto mb-4 object-contain" />}
        <h1 className="text-xl font-bold uppercase tracking-wider">Republic of the Philippines</h1>
        <p className="text-sm mt-1">{barangay?.province}</p>
        <p className="text-sm">{barangay?.city_municipality}</p>
        <h2 className="text-lg font-bold uppercase mt-2">Office of the Punong Barangay</h2>
        <p className="text-sm font-medium">{barangay?.barangay_name}</p>
      </div>

      <div className="border-t-2 border-b-2 border-slate-800 py-1 my-6">
        <h2 className="text-center text-base font-bold uppercase">{docTypeName}</h2>
      </div>

      <div className="text-sm leading-relaxed text-justify space-y-4">
        <p>
          TO WHOM IT MAY CONCERN:
        </p>
        <p>
          This is to certify that <strong className="underline">{resolveField('RESIDENT_NAME') || '_______________________'}</strong>,
          {' '}of legal age, {resolveField('CIVIL_STATUS') || 'single'},
          {' '}Filipino citizen, and a resident of {resolveField('ADDRESS') || resolveField('PUROK') || '_______________________'},
          {barangay?.barangay_name ? `, ${barangay.barangay_name}` : ''}, {barangay?.city_municipality || ''}, {barangay?.province || ''}.
        </p>
        {resolveField('PURPOSE') && (
          <p>
            This certification is issued upon the request of the above-named person for <strong>{resolveField('PURPOSE')}</strong>.
          </p>
        )}
        {Object.entries(customFields).map(([key, value]) => (
          <p key={key}>{key.replace(/_/g, ' ')}: <strong>{value}</strong></p>
        ))}
        <p>
          Issued this {new Date().toLocaleDateString('en-PH', { day: 'numeric', month: 'long', year: 'numeric' })} at {barangay?.barangay_name || ''}, {barangay?.city_municipality || ''}, {barangay?.province || ''}.
        </p>
      </div>

      <div className="mt-16 text-center">
        <p className="font-bold uppercase underline">{resolveField('PUNONG_BARANGAY') || barangay?.punong_barangay || '_______________________'}</p>
        <p className="text-xs mt-1">Punong Barangay</p>
      </div>
    </div>
  );
}

// ============================================================================
// TEMPLATE EDITOR (simplified visual editor)
// ============================================================================
function TemplateEditor({ templateId }: { templateId: string }) {
  const { session } = useAuth();
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
  const [template, setTemplate] = useState<DocumentTemplate | null>(null);
  const [elements, setElements] = useState<TemplateElement[]>([]);
  const [pageSettings, setPageSettings] = useState<TemplatePageSettings>({
    pageSize: 'letter',
    orientation: 'portrait',
    marginTop: 60,
    marginBottom: 60,
    marginLeft: 60,
    marginRight: 60,
  });
  const [templateName, setTemplateName] = useState('');
  const [selectedDocType, setSelectedDocType] = useState('');
  const [selectedEl, setSelectedEl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: dt } = await supabase.from('document_types').select('*').order('display_order');
      if (dt) setDocTypes(dt as DocumentType[]);

      if (templateId !== 'new') {
        const { data: tm } = await supabase.from('document_templates').select('*').eq('id', templateId).maybeSingle();
        if (tm) {
          const t = tm as DocumentTemplate;
          setTemplate(t);
          setTemplateName(t.name);
          setSelectedDocType(t.document_type_id ?? '');
          setElements(t.template_json.elements || []);
          setPageSettings(t.template_json.page || pageSettings);
        }
      } else {
        setTemplateName('New Template');
        setElements([
          {
            id: crypto.randomUUID(),
            type: 'text',
            x: 180,
            y: 50,
            width: 250,
            height: 30,
            rotation: 0,
            zIndex: 1,
            locked: false,
            content: 'CERTIFICATE',
            fontFamily: 'Times New Roman, serif',
            fontSize: 18,
            bold: true,
            align: 'center',
            color: '#000000',
          },
        ]);
      }
      setLoading(false);
    };
    fetchData();
  }, [templateId]);

  const addElement = (type: TemplateElement['type']) => {
    const newEl: TemplateElement = {
      id: crypto.randomUUID(),
      type,
      x: 100,
      y: 100,
      width: 200,
      height: 50,
      rotation: 0,
      zIndex: elements.length + 1,
      locked: false,
      content: type === 'text' ? 'New Text' : '',
      fontFamily: 'Times New Roman, serif',
      fontSize: 12,
      color: '#000000',
      align: 'left',
    };
    setElements([...elements, newEl]);
    setSelectedEl(newEl.id);
  };

  const addField = (field: string) => {
    const newEl: TemplateElement = {
      id: crypto.randomUUID(),
      type: 'text',
      x: 100,
      y: 200,
      width: 250,
      height: 30,
      rotation: 0,
      zIndex: elements.length + 1,
      locked: false,
      field,
      content: `{{${field}}}`,
      fontFamily: 'Times New Roman, serif',
      fontSize: 12,
      bold: false,
      color: '#000000',
      align: 'left',
    };
    setElements([...elements, newEl]);
    setSelectedEl(newEl.id);
  };

  const updateElement = (id: string, updates: Partial<TemplateElement>) => {
    setElements(elements.map((el) => el.id === id ? { ...el, ...updates } : el));
  };

  const deleteElement = (id: string) => {
    setElements(elements.filter((el) => el.id !== id));
    setSelectedEl(null);
  };

  const handleSave = async () => {
    setSaving(true);
    const data = {
      name: templateName,
      document_type_id: selectedDocType || null,
      template_json: { page: pageSettings, elements },
      is_active: true,
      updated_by: session?.user.id,
    };
    if (template) {
      await supabase.from('document_templates').update(data).eq('id', template.id);
      await logAudit('Template Updated', 'template', template.id, `Updated ${templateName}`);
    } else {
      const insertData = { ...data, created_by: session?.user.id };
      const { data: newRec } = await supabase.from('document_templates').insert(insertData).select().maybeSingle();
      if (newRec) await logAudit('Template Created', 'template', (newRec as DocumentTemplate).id, `Created ${templateName}`);
    }
    setSaving(false);
    navigate('documents');
  };

  const dims = PAGE_DIMENSIONS[pageSettings.pageSize] ?? PAGE_DIMENSIONS.letter;
  const isLandscape = pageSettings.orientation === 'landscape';
  const canvasWidth = isLandscape ? dims.height : dims.width;
  const canvasHeight = isLandscape ? dims.width : dims.height;

  const selectedElement = elements.find((el) => el.id === selectedEl);

  if (loading) return <div className="p-6 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button className="btn-ghost" onClick={() => navigate('documents')}><ArrowLeft className="h-4 w-4" /> Back</button>
          <h1 className="text-xl font-bold text-slate-900">Template Editor</h1>
        </div>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Save Template
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] gap-4">
        {/* Left: Tools */}
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-xs font-bold text-slate-800 mb-3">Template Settings</h3>
            <div className="space-y-3">
              <div><label className="label">Name</label><input className="input" value={templateName} onChange={(e) => setTemplateName(e.target.value)} /></div>
              <div><label className="label">Document Type</label>
                <select className="select" value={selectedDocType} onChange={(e) => setSelectedDocType(e.target.value)}>
                  <option value="">None</option>
                  {docTypes.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="label">Page Size</label>
                  <select className="select" value={pageSettings.pageSize} onChange={(e) => setPageSettings({ ...pageSettings, pageSize: e.target.value as TemplatePageSettings['pageSize'] })}>
                    <option value="a4">A4</option><option value="letter">Letter</option><option value="legal">Legal</option>
                  </select>
                </div>
                <div><label className="label">Orientation</label>
                  <select className="select" value={pageSettings.orientation} onChange={(e) => setPageSettings({ ...pageSettings, orientation: e.target.value as TemplatePageSettings['orientation'] })}>
                    <option value="portrait">Portrait</option><option value="landscape">Landscape</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="text-xs font-bold text-slate-800 mb-3">Add Elements</h3>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-secondary text-xs" onClick={() => addElement('text')}>Text</button>
              <button className="btn-secondary text-xs" onClick={() => addElement('image')}>Image</button>
              <button className="btn-secondary text-xs" onClick={() => addElement('shape')}>Shape</button>
              <button className="btn-secondary text-xs" onClick={() => addElement('line')}>Line</button>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="text-xs font-bold text-slate-800 mb-3">Data Fields</h3>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {['RESIDENT_NAME', 'FIRST_NAME', 'LAST_NAME', 'DOB', 'AGE', 'SEX', 'CIVIL_STATUS', 'ADDRESS', 'PUROK', 'VILLAGE', 'HOUSEHOLD_ID', 'RELATIONSHIP', 'PURPOSE', 'DATE', 'BARANGAY_NAME', 'CITY_MUNICIPALITY', 'PROVINCE', 'PUNONG_BARANGAY'].map((f) => (
                <button key={f} className="w-full text-left text-xs px-2 py-1 rounded hover:bg-blue-50 text-slate-600 hover:text-blue-700" onClick={() => addField(f)}>
                  {`{{${f}}}`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Center: Canvas */}
        <div className="flex justify-center overflow-auto bg-slate-100 rounded-xl p-4">
          <div
            ref={canvasRef}
            className="bg-white shadow-lg relative"
            style={{ width: `${canvasWidth}px`, minHeight: `${canvasHeight}px`, padding: `${pageSettings.marginTop}px ${pageSettings.marginRight}px ${pageSettings.marginBottom}px ${pageSettings.marginLeft}px` }}
            onClick={(e) => { if (e.target === canvasRef.current) setSelectedEl(null); }}
          >
            {elements.sort((a, b) => a.zIndex - b.zIndex).map((el) => (
              <div
                key={el.id}
                className={`absolute cursor-move ${selectedEl === el.id ? 'ring-2 ring-blue-500' : ''}`}
                style={{
                  left: `${el.x}px`,
                  top: `${el.y}px`,
                  width: `${el.width}px`,
                  minHeight: `${el.height}px`,
                  transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                  zIndex: el.zIndex,
                }}
                onClick={(e) => { e.stopPropagation(); setSelectedEl(el.id); }}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('id', el.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={(e) => {
                  const rect = canvasRef.current?.getBoundingClientRect();
                  if (rect) {
                    const newX = e.clientX - rect.left - 20;
                    const newY = e.clientY - rect.top - 10;
                    updateElement(el.id, { x: Math.max(0, newX), y: Math.max(0, newY) });
                  }
                }}
              >
                {el.type === 'image' && el.src && <img src={el.src} alt="" className="max-w-full max-h-full object-contain" />}
                {el.type === 'shape' && <div className="w-full h-full" style={{ background: el.fill || '#e0e0e0', borderRadius: el.shape === 'circle' ? '50%' : el.borderRadius ?? 0 }} />}
                {el.type === 'line' && <div style={{ width: '100%', height: `${el.strokeWidth || 1}px`, background: el.stroke || '#000' }} />}
                {el.type === 'text' && (
                  <div style={{
                    fontFamily: el.fontFamily || 'Times New Roman, serif',
                    fontSize: `${el.fontSize || 12}pt`,
                    fontWeight: el.bold ? 'bold' : 'normal',
                    fontStyle: el.italic ? 'italic' : 'normal',
                    textDecoration: el.underline ? 'underline' : 'none',
                    color: el.color || '#000',
                    textAlign: el.align || 'left',
                  }}>
                    {el.field ? `{{${el.field}}}` : el.content}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Properties */}
        <div className="space-y-4">
          {selectedElement ? (
            <div className="card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800">Element Properties</h3>
                <button className="text-red-500 text-xs" onClick={() => deleteElement(selectedElement.id)}>Delete</button>
              </div>

              {selectedElement.type === 'text' && (
                <>
                  <div><label className="label">Content</label><textarea className="input text-xs" rows={3} value={selectedElement.content ?? ''} onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="label">Font Size</label><input type="number" className="input text-xs" value={selectedElement.fontSize ?? 12} onChange={(e) => updateElement(selectedElement.id, { fontSize: parseInt(e.target.value) || 12 })} /></div>
                    <div><label className="label">Color</label><input type="color" className="input text-xs h-9" value={selectedElement.color ?? '#000000'} onChange={(e) => updateElement(selectedElement.id, { color: e.target.value })} /></div>
                  </div>
                  <div>
                    <label className="label">Alignment</label>
                    <select className="select text-xs" value={selectedElement.align ?? 'left'} onChange={(e) => updateElement(selectedElement.id, { align: e.target.value as TemplateElement['align'] })}>
                      <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option><option value="justify">Justify</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={selectedElement.bold ?? false} onChange={(e) => updateElement(selectedElement.id, { bold: e.target.checked })} /> Bold</label>
                    <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={selectedElement.italic ?? false} onChange={(e) => updateElement(selectedElement.id, { italic: e.target.checked })} /> Italic</label>
                    <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={selectedElement.underline ?? false} onChange={(e) => updateElement(selectedElement.id, { underline: e.target.checked })} /> Underline</label>
                  </div>
                </>
              )}

              {selectedElement.type === 'image' && (
                <div><label className="label">Image URL</label><input className="input text-xs" value={selectedElement.src ?? ''} onChange={(e) => updateElement(selectedElement.id, { src: e.target.value })} /></div>
              )}

              {selectedElement.type === 'shape' && (
                <>
                  <div><label className="label">Fill Color</label><input type="color" className="input text-xs h-9" value={selectedElement.fill ?? '#e0e0e0'} onChange={(e) => updateElement(selectedElement.id, { fill: e.target.value })} /></div>
                  <div>
                    <label className="label">Shape</label>
                    <select className="select text-xs" value={selectedElement.shape ?? 'rect'} onChange={(e) => updateElement(selectedElement.id, { shape: e.target.value as TemplateElement['shape'] })}>
                      <option value="rect">Rectangle</option><option value="circle">Circle</option>
                    </select>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-2 border-t pt-3">
                <div><label className="label">X</label><input type="number" className="input text-xs" value={selectedElement.x} onChange={(e) => updateElement(selectedElement.id, { x: parseInt(e.target.value) || 0 })} /></div>
                <div><label className="label">Y</label><input type="number" className="input text-xs" value={selectedElement.y} onChange={(e) => updateElement(selectedElement.id, { y: parseInt(e.target.value) || 0 })} /></div>
                <div><label className="label">Width</label><input type="number" className="input text-xs" value={selectedElement.width} onChange={(e) => updateElement(selectedElement.id, { width: parseInt(e.target.value) || 100 })} /></div>
                <div><label className="label">Height</label><input type="number" className="input text-xs" value={selectedElement.height} onChange={(e) => updateElement(selectedElement.id, { height: parseInt(e.target.value) || 50 })} /></div>
              </div>
            </div>
          ) : (
            <div className="card p-4">
              <h3 className="text-xs font-bold text-slate-800 mb-2">No Element Selected</h3>
              <p className="text-xs text-slate-500">Click an element on the canvas to edit its properties, or add new elements from the left panel.</p>
            </div>
          )}

          <div className="card p-4">
            <h3 className="text-xs font-bold text-slate-800 mb-2">Margins</h3>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label">Top</label><input type="number" className="input text-xs" value={pageSettings.marginTop} onChange={(e) => setPageSettings({ ...pageSettings, marginTop: parseInt(e.target.value) || 0 })} /></div>
              <div><label className="label">Bottom</label><input type="number" className="input text-xs" value={pageSettings.marginBottom} onChange={(e) => setPageSettings({ ...pageSettings, marginBottom: parseInt(e.target.value) || 0 })} /></div>
              <div><label className="label">Left</label><input type="number" className="input text-xs" value={pageSettings.marginLeft} onChange={(e) => setPageSettings({ ...pageSettings, marginLeft: parseInt(e.target.value) || 0 })} /></div>
              <div><label className="label">Right</label><input type="number" className="input text-xs" value={pageSettings.marginRight} onChange={(e) => setPageSettings({ ...pageSettings, marginRight: parseInt(e.target.value) || 0 })} /></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
