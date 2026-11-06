import React, { useEffect, useRef, useState } from 'react';
import {
  buildPages,
  pageLabel,
  createEmptyProject,
  validateProject,
  newProperty,
  moveItem,
  uid,
  MAX_PROPERTIES,
  money
} from './lib/project.js';
import { loadImage, saveFile, openFile, readDraft, writeDraft } from './lib/files.js';
import { Slide, PrintDeck } from './components/Slides.jsx';
function Field({
  label,
  value,
  onChange,
  maxLength = 60,
  type = 'text',
  multiline = false,
  placeholder = '',
  ...rest
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          maxLength={maxLength}
          placeholder={placeholder}
          {...rest}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={e =>
            onChange(
              type === 'number'
                ? e.target.value === ''
                  ? ''
                  : Number(e.target.value)
                : e.target.value
            )
          }
          maxLength={maxLength}
          placeholder={placeholder}
          {...rest}
        />
      )}
    </label>
  );
}
function ScaledSlide({ children }) {
  const ref = useRef();
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const o = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    o.observe(ref.current);
    return () => o.disconnect();
  }, []);
  return (
    <div className="scaled-slide" ref={ref} style={{ height: (width * 540) / 960 }}>
      <div style={{ transform: `scale(${width / 960})`, transformOrigin: 'top left' }}>
        {children}
      </div>
    </div>
  );
}
export default function App() {
  const [project, setProject] = useState(createEmptyProject()),
    [active, setActive] = useState('general'),
    [tab, setTab] = useState('details'),
    [pageIndex, setPageIndex] = useState(0),
    [full, setFull] = useState(false),
    [ready, setReady] = useState(false),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState('Έτοιμο'),
    [notice, setNotice] = useState(null),
    [printReady, setPrintReady] = useState(false);
  const fileRef = useRef(),
    deckRef = useRef(),
    projectRef = useRef(project);
  projectRef.current = project;
  const pages = buildPages(project);
  const index = Math.min(pageIndex, pages.length - 1);
  const property = project.properties.find(p => p.id === active);
  useEffect(() => {
    let live = true;
    readDraft()
      .then(p => {
        if (live && p) {
          setProject(validateProject(p));
          setDirty(true);
          setStatus('Επαναφέρθηκε το τοπικό πρόχειρο');
        }
      })
      .catch(() => live && setStatus('Η τοπική αποθήκευση δεν είναι διαθέσιμη'))
      .finally(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      writeDraft(project)
        .then(() => setStatus('Πρόχειρο αποθηκευμένο σε αυτόν τον υπολογιστή'))
        .catch(() => setStatus('Το πρόχειρο δεν αποθηκεύτηκε · κατεβάστε αρχείο έργου'));
    }, 700);
    return () => clearTimeout(t);
  }, [project, ready]);
  useEffect(() => {
    const h = e => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6500);
    return () => clearTimeout(t);
  }, [notice]);
  function acceptProject(p) {
    if (
      dirty &&
      !confirm(
        'Να αντικατασταθεί το τρέχον έργο; Αποθηκεύστε πρώτα τις αλλαγές που θέλετε να κρατήσετε.'
      )
    )
      return;
    setProject(validateProject(p, { portable: true }));
    setDirty(false);
    setPrintReady(false);
    setPageIndex(0);
    setActive('general');
    setNotice({ text: 'Το έργο άνοιξε με επιτυχία.' });
  }
  function update(fn) {
    setProject(p => fn(p));
    setDirty(true);
    setPrintReady(false);
  }
  function meta(key, value) {
    update(p => ({ ...p, presentation: { ...p.presentation, [key]: value } }));
  }
  function patch(id, values) {
    update(p => ({
      ...p,
      properties: p.properties.map(v => (v.id === id ? { ...v, ...values } : v))
    }));
  }
  function choose(p) {
    setActive(p.id);
    setTab('details');
    const i = pages.findIndex(v => v.type === 'property' && v.property.id === p.id);
    if (i >= 0) setPageIndex(i);
  }
  async function action(fn) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setNotice({ error: true, text: e.message || 'Κάτι δεν ολοκληρώθηκε. Δοκιμάστε ξανά.' });
    } finally {
      setBusy(false);
    }
  }
  function newProject() {
    if (
      dirty &&
      !confirm('Υπάρχουν αλλαγές που δεν έχουν αποθηκευτεί σε αρχείο έργου. Θέλετε να συνεχίσετε;')
    ) {
      return;
    }

    update(() => createEmptyProject());
    setActive('general');
    setPageIndex(0);
  }
  const add = () => {
    if (project.properties.length >= MAX_PROPERTIES) return;
    const p = newProperty();
    update(v => ({ ...v, properties: [...v.properties, p] }));
    setActive(p.id);
    setTab('details');
  };
  function duplicate(p) {
    if (project.properties.length >= MAX_PROPERTIES) return;
    const copy = {
      ...structuredClone(p),
      id: uid(),
      photos: p.photos.map(ph => ({ ...ph, id: uid() }))
    };
    update(v => ({ ...v, properties: [...v.properties, copy] }));
    setActive(copy.id);
  }
  function remove(p) {
    if (!confirm(`Να αφαιρεθεί το «${p.title}»;`)) return;
    update(v => ({ ...v, properties: v.properties.filter(v => v.id !== p.id) }));
    setActive('general');
  }
  function reorder(from, to) {
    update(p => ({ ...p, properties: moveItem(p.properties, from, to) }));
  }
  async function uploadPhotos(files, replaceIndex = null) {
    const id = property.id;
    const existing = property.photos;
    const chosen = [...files];
    if (replaceIndex === null && chosen.length > 3 - existing.length)
      throw Error('Μπορείτε να επιλέξετε έως 3 φωτογραφίες συνολικά.');
    const results = [];
    for (const f of chosen) {
      results.push({ id: uid(), src: await loadImage(f), caption: '' });
    }
    const photos =
      replaceIndex === null
        ? [...existing, ...results]
        : existing.map((ph, i) =>
            i === replaceIndex ? { ...results[0], caption: ph.caption } : ph
          );
    patch(id, { photos });
    setTab('photos');
  }
  async function preparePrint() {
    setFull(true);
    await new Promise(r => setTimeout(r, 100));
    await document.fonts.ready;
    const imgs = [...deckRef.current.querySelectorAll('img')];
    await Promise.all(imgs.map(img => img.decode()));
    const slides = [...deckRef.current.querySelectorAll('.slide')];
    for (const [i, s] of slides.entries()) {
      const footer = s.querySelector('.slide-footer'),
        note = s.querySelector('.property-note'),
        cols = s.querySelector('.property-columns');
      if (
        cols &&
        cols.getBoundingClientRect().bottom > (note || footer).getBoundingClientRect().top - 8
      )
        throw Error(
          `Το κείμενο στη σελίδα ${i + 1} είναι πολύ μεγάλο. Συντομεύστε την περιγραφή, τα χαρακτηριστικά ή την υποσημείωση.`
        );
      const h = s.querySelector('.slide-header h2'),
        content = s.querySelector('.metrics,.gallery,.comparison,.overview-grid');
      if (
        h &&
        content &&
        h.getBoundingClientRect().bottom > content.getBoundingClientRect().top - 4
      )
        throw Error(`Ο τίτλος στη σελίδα ${i + 1} είναι πολύ μεγάλος. Συντομεύστε τον.`);
    }
    setPrintReady(true);
  }
  return (
    <>
      <div className="app-shell" aria-busy={busy}>
        <aside className="sidebar">
          <a
            className="brand"
            href="#"
            onClick={e => {
              e.preventDefault();
              setActive('general');
              setPageIndex(0);
            }}
          >
            <span className="brand-mark">
              L<span>↗</span>
            </span>
            <div>
              LEAF<span>Presentation Builder</span>
            </div>
          </a>
          <div className="sidebar-heading">ΤΟ ΕΡΓΟ ΣΑΣ</div>
          <button
            className={`nav-general ${active === 'general' ? 'selected' : ''}`}
            onClick={() => {
              setActive('general');
              setPageIndex(0);
            }}
          >
            <span>▤</span> Στοιχεία παρουσίασης
          </button>
          <div className="sidebar-heading property-heading">
            ΑΚΙΝΗΤΑ <span>{project.properties.length}</span>
          </div>
          <div className="property-list">
            {project.properties.map((p, i) => (
              <div
                className={`property-nav ${active === p.id ? 'selected' : ''} ${!p.included ? 'muted' : ''}`}
                key={p.id}
              >
                <button className="property-select" onClick={() => choose(p)}>
                  <span className="nav-number">{String(i + 1).padStart(2, '0')}</span>
                  <span>
                    <b>{p.area || p.title}</b>
                    <small>
                      {p.sqm || '—'} τ.μ. · {money(p.price)}
                    </small>
                  </span>
                </button>
                <div className="order-buttons">
                  <button
                    aria-label={`Μετακίνηση ακινήτου ${i + 1} πάνω`}
                    disabled={i === 0}
                    onClick={() => reorder(i, i - 1)}
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`Μετακίνηση ακινήτου ${i + 1} κάτω`}
                    disabled={i === project.properties.length - 1}
                    onClick={() => reorder(i, i + 1)}
                  >
                    ↓
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            className="add-property"
            onClick={add}
            disabled={!ready || project.properties.length >= 40}
          >
            ＋ Προσθήκη ακινήτου
          </button>
          <div className="sidebar-bottom">
            <span className="local-dot" /> Τοπικός χώρος εργασίας
            <p>
              Τα στοιχεία σας παραμένουν σε αυτόν τον υπολογιστή. Κατεβάστε το έργο για μεταφορά ή
              αντίγραφο ασφαλείας.
            </p>
            <button onClick={() => newProject(false)}>Νέο κενό έργο</button>
          </div>
        </aside>
        <main>
          <header className="toolbar">
            <div>
              <span className="breadcrumb">LEAF WORKSPACE / ΠΑΡΟΥΣΙΑΣΕΙΣ</span>
              <h1>Η επόμενη πρόταση, έτοιμη.</h1>
            </div>
            <div className="toolbar-actions">
              <button
                disabled={busy || !ready}
                onClick={() =>
                  window.leafDesktop
                    ? action(async () => {
                        const p = await window.leafDesktop.openProject();
                        if (p) acceptProject(p);
                      })
                    : fileRef.current.click()
                }
              >
                Άνοιγμα έργου
              </button>
              <button
                disabled={busy || !ready}
                onClick={() =>
                  action(async () => {
                    const snapshot = project;
                    const saved = await saveFile(snapshot);
                    if (!saved) return;
                    if (projectRef.current === snapshot) setDirty(false);
                    setNotice({ text: 'Το αρχείο έργου αποθηκεύτηκε μαζί με τις φωτογραφίες.' });
                  })
                }
              >
                ↓ Αποθήκευση έργου{dirty ? ' •' : ''}
              </button>
              <button
                className="primary"
                disabled={busy || !ready}
                onClick={() => action(preparePrint)}
              >
                Εξαγωγή PDF ↗
              </button>
            </div>
          </header>
          <div className="workspace">
            <section className="editor">
              <div className="section-heading">
                <div className="eyebrow">
                  {property ? 'ΕΠΕΞΕΡΓΑΣΙΑ ΑΚΙΝΗΤΟΥ' : 'ΤΟ ΠΡΟΤΥΠΟ ΣΑΣ'}
                </div>
                <h2>{property ? property.area || 'Νέο ακίνητο' : 'Στοιχεία παρουσίασης'}</h2>
                <p>
                  {property
                    ? 'Οι αλλαγές εμφανίζονται αμέσως στην προεπισκόπηση.'
                    : 'Η ταυτότητα LEAF, σε κάθε παρουσίαση.'}
                </p>
              </div>
              {property ? (
                <>
                  <div className="tabs">
                    <button
                      className={tab === 'details' ? 'active' : ''}
                      onClick={() => setTab('details')}
                    >
                      Στοιχεία & κείμενα
                    </button>
                    <button
                      className={tab === 'photos' ? 'active' : ''}
                      onClick={() => {
                        setTab('photos');
                        const i = pages.findIndex(
                          p => p.type === 'photos' && p.property.id === property.id
                        );
                        if (i >= 0) setPageIndex(i);
                      }}
                    >
                      Φωτογραφίες <span>{property.photos.length}/3</span>
                    </button>
                  </div>
                  {tab === 'details' ? (
                    <div className="form-stack">
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={property.included}
                          onChange={e => patch(property.id, { included: e.target.checked })}
                        />{' '}
                        Εμφάνιση στην παρουσίαση
                      </label>
                      <Field
                        label="Τίτλος ακινήτου"
                        value={property.title}
                        onChange={title => patch(property.id, { title })}
                      />
                      <Field
                        label="Περιοχή"
                        value={property.area}
                        onChange={area => patch(property.id, { area })}
                      />
                      <div className="field-grid">
                        {[
                          ['Τιμή πώλησης (€)', 'price', 'number'],
                          ['Εμβαδόν (τ.μ.)', 'sqm', 'number'],
                          ['Όροφος', 'floor', 'text'],
                          ['Υπνοδωμάτια', 'bedrooms', 'text'],
                          ['Έτος κατασκευής', 'year', 'text'],
                          ['Ενεργειακή κλάση', 'energy', 'text']
                        ].map(([label, k, type]) => (
                          <Field
                            key={k}
                            label={label}
                            value={property[k]}
                            type={type}
                            min={type === 'number' ? 0 : undefined}
                            max={k === 'price' ? 1e10 : k === 'sqm' ? 1e6 : undefined}
                            step={type === 'number' ? 'any' : undefined}
                            maxLength={k === 'bedrooms' || k === 'energy' ? 12 : 18}
                            onChange={v => patch(property.id, { [k]: v })}
                          />
                        ))}
                      </div>
                      <Field
                        label="Σύντομη περιγραφή"
                        value={property.description}
                        onChange={description => patch(property.id, { description })}
                        multiline
                        maxLength={650}
                        rows={5}
                      />
                      <div className="field">
                        <span>
                          Δυνατά σημεία <small>{property.features.length}/8</small>
                        </span>
                        <div className="features-editor">
                          {property.features.map((f, i) => (
                            <div key={i}>
                              <span>•</span>
                              <input
                                aria-label={`Χαρακτηριστικό ${i + 1}`}
                                maxLength={90}
                                value={f}
                                onChange={e =>
                                  patch(property.id, {
                                    features: property.features.map((v, j) =>
                                      j === i ? e.target.value : v
                                    )
                                  })
                                }
                              />
                              <button
                                aria-label={`Αφαίρεση χαρακτηριστικού ${i + 1}`}
                                onClick={() =>
                                  patch(property.id, {
                                    features: property.features.filter((_, j) => j !== i)
                                  })
                                }
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                        <button
                          className="text-button"
                          disabled={property.features.length >= 8}
                          onClick={() =>
                            patch(property.id, { features: [...property.features, ''] })
                          }
                        >
                          ＋ Προσθήκη χαρακτηριστικού
                        </button>
                      </div>
                      <Field
                        label="Προαιρετική υποσημείωση"
                        value={property.note}
                        onChange={note => patch(property.id, { note })}
                        maxLength={180}
                        multiline
                        rows={2}
                        placeholder="π.χ. Αποπεράτωση Σεπτέμβριος του 2027"
                      />
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={property.isRender}
                          onChange={e => patch(property.id, { isRender: e.target.checked })}
                        />{' '}
                        Οι εικόνες είναι 3D απεικονίσεις
                      </label>
                    </div>
                  ) : (
                    <div className="photos-editor">
                      <p className="hint">
                        Έως 3 εικόνες JPG, PNG ή WebP. Η εφαρμογή διατηρεί ολόκληρο το κάδρο χωρίς
                        παραμόρφωση.
                      </p>
                      {property.photos.map((ph, i) => (
                        <div className="photo-edit" key={ph.id}>
                          <img src={ph.src} alt={ph.caption || `Φωτογραφία ${i + 1}`} />
                          <div>
                            <Field
                              label={`Λεζάντα ${i + 1}`}
                              value={ph.caption}
                              maxLength={50}
                              onChange={caption =>
                                patch(property.id, {
                                  photos: property.photos.map(v =>
                                    v.id === ph.id ? { ...v, caption } : v
                                  )
                                })
                              }
                            />
                            <div className="photo-actions">
                              <button
                                disabled={i === 0}
                                onClick={() =>
                                  patch(property.id, {
                                    photos: moveItem(property.photos, i, i - 1)
                                  })
                                }
                                aria-label={`Φωτογραφία ${i + 1} πάνω`}
                              >
                                ↑
                              </button>
                              <button
                                disabled={i === property.photos.length - 1}
                                onClick={() =>
                                  patch(property.id, {
                                    photos: moveItem(property.photos, i, i + 1)
                                  })
                                }
                                aria-label={`Φωτογραφία ${i + 1} κάτω`}
                              >
                                ↓
                              </button>
                              <label className="file-button">
                                Αλλαγή
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp"
                                  disabled={busy}
                                  onChange={e => {
                                    const f = e.target.files[0];
                                    if (f) action(() => uploadPhotos([f], i));
                                    e.target.value = '';
                                  }}
                                />
                              </label>
                              <button
                                className="danger-link"
                                onClick={() =>
                                  patch(property.id, {
                                    photos: property.photos.filter(v => v.id !== ph.id)
                                  })
                                }
                              >
                                Αφαίρεση
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {property.photos.length < 3 && (
                        <label className={`upload-zone ${busy ? 'disabled' : ''}`}>
                          <span>＋</span>
                          <b>Προσθήκη φωτογραφιών</b>
                          <small>Έως 15 MB ανά εικόνα</small>
                          <input
                            type="file"
                            multiple
                            accept="image/jpeg,image/png,image/webp"
                            disabled={busy}
                            onChange={e => {
                              const fs = [...e.target.files];
                              if (fs.length) action(() => uploadPhotos(fs));
                              e.target.value = '';
                            }}
                          />
                        </label>
                      )}
                      <p className="hint">
                        Οι εικόνες ανεβαίνουν τοπικά. Δεν γίνεται αυτόματη αφαίρεση watermark.
                      </p>
                    </div>
                  )}
                  <div className="property-tools">
                    <button
                      disabled={project.properties.length >= 40}
                      onClick={() => duplicate(property)}
                    >
                      Αντιγραφή ακινήτου
                    </button>
                    <button className="danger-link" onClick={() => remove(property)}>
                      Διαγραφή
                    </button>
                  </div>
                </>
              ) : (
                <div className="form-stack">
                  <Field
                    label="Τίτλος παρουσίασης"
                    value={project.presentation.title}
                    onChange={v => meta('title', v)}
                  />
                  <Field
                    label="Υπότιτλος / περιοχές"
                    value={project.presentation.subtitle}
                    maxLength={100}
                    onChange={v => meta('subtitle', v)}
                  />
                  <Field
                    label="Ημερομηνία ή περίοδος"
                    value={project.presentation.date}
                    maxLength={40}
                    onChange={v => meta('date', v)}
                  />
                  <div className="form-divider" />
                  <h3>Ενότητες παρουσίασης</h3>
                  {[
                    ['overview', 'Επισκόπηση ακινήτων'],
                    ['comparison', 'Συγκριτικός πίνακας'],
                    ['closing', 'Σελίδα επικοινωνίας']
                  ].map(([k, l]) => (
                    <label className="check option-row" key={k}>
                      <span>{l}</span>
                      <input
                        type="checkbox"
                        checked={project.presentation[k]}
                        onChange={e => meta(k, e.target.checked)}
                      />
                    </label>
                  ))}
                  <div className="form-divider" />
                  <h3>Ταυτότητα & επικοινωνία</h3>
                  <div className="logo-control">
                    {project.presentation.logo && (
                      <img src={project.presentation.logo} alt="Λογότυπο LEAF" />
                    )}
                    <label className="file-button">
                      Αλλαγή λογοτύπου
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        disabled={busy}
                        onChange={e => {
                          const f = e.target.files[0];
                          if (f) action(async () => meta('logo', await loadImage(f)));
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                  {[
                    ['Επωνυμία', 'brand', 65],
                    ['Email', 'email', 90],
                    ['Τηλέφωνο', 'phone', 50],
                    ['Ιστοσελίδα', 'website', 90]
                  ].map(([label, k, max]) => (
                    <Field
                      key={k}
                      label={label}
                      maxLength={max}
                      value={project.presentation[k]}
                      onChange={v => meta(k, v)}
                    />
                  ))}
                </div>
              )}
            </section>
            <section className="preview-pane">
              <div className="preview-top">
                <div>
                  <span className="live-dot" /> ΖΩΝΤΑΝΗ ΠΡΟΕΠΙΣΚΟΠΗΣΗ
                </div>
                <button onClick={() => setFull(true)}>Όλες οι σελίδες ↗</button>
              </div>
              <div className="preview-stage">
                <ScaledSlide>
                  <Slide page={pages[index]} project={project} number={index + 1} />
                </ScaledSlide>
                <div className="preview-pagination">
                  <button
                    disabled={index === 0}
                    onClick={() => setPageIndex(index - 1)}
                    aria-label="Προηγούμενη σελίδα"
                  >
                    ←
                  </button>
                  <span>
                    {String(index + 1).padStart(2, '0')} <span>/ {pages.length} σελίδες</span>
                  </span>
                  <button
                    disabled={index === pages.length - 1}
                    onClick={() => setPageIndex(index + 1)}
                    aria-label="Επόμενη σελίδα"
                  >
                    →
                  </button>
                </div>
              </div>
              <div className="page-list">
                <div className="eyebrow">ΔΟΜΗ ΠΑΡΟΥΣΙΑΣΗΣ</div>
                {pages.map((p, i) => (
                  <button
                    key={i}
                    className={i === index ? 'active' : ''}
                    onClick={() => setPageIndex(i)}
                  >
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    {pageLabel(p)}
                    <span>↗</span>
                  </button>
                ))}
              </div>
              <div className="save-note">
                <b>Ένα αρχείο. Ολόκληρη η παρουσίαση.</b>
                <p>
                  Η «Αποθήκευση έργου» κρατά κείμενα και εικόνες σε αρχείο .leaf.json. Το PDF είναι
                  το τελικό αντίγραφο για τον πελάτη.
                </p>
              </div>
            </section>
          </div>
          <footer className="statusbar">
            <span>
              <i className="local-dot" />
              {busy ? 'Επεξεργασία…' : status}
            </span>
            <span>
              {project.properties.filter(p => p.included).length} ακίνητα · {pages.length} σελίδες ·{' '}
              {dirty ? 'Αλλαγές προς εξαγωγή' : 'Αρχείο ενημερωμένο'}
            </span>
          </footer>
        </main>
      </div>
      <input
        ref={fileRef}
        hidden
        type="file"
        accept=".json,.leaf.json,application/json"
        onChange={e => {
          const file = e.target.files[0];
          e.target.value = '';
          if (!file) return;
          action(async () => {
            const p = await openFile(file);
            if (
              dirty &&
              !confirm(
                'Να αντικατασταθεί το τρέχον έργο; Κατεβάστε πρώτα τις αλλαγές που θέλετε να κρατήσετε.'
              )
            )
              return;
            setProject(p);
            setDirty(false);
            setPrintReady(false);
            setPageIndex(0);
            setActive('general');
            setNotice({ text: 'Το έργο άνοιξε με επιτυχία.' });
          });
        }}
      />
      {notice && (
        <div role="alert" className={`toast ${notice.error ? 'error' : ''}`}>
          <span>{notice.text}</span>
          <button aria-label="Κλείσιμο ειδοποίησης" onClick={() => setNotice(null)}>
            ×
          </button>
        </div>
      )}
      {full && (
        <div
          className="preview-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Προεπισκόπηση παρουσίασης"
        >
          <header>
            <div>
              <b>Προεπισκόπηση παρουσίασης</b>
              <small>{pages.length} σελίδες · 16:9</small>
            </div>
            <div>
              {printReady ? (
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() =>
                    window.leafDesktop
                      ? action(async () => {
                          await preparePrint();
                          if (await window.leafDesktop.exportPDF(project.presentation.title))
                            setNotice({ text: 'Το PDF αποθηκεύτηκε.' });
                        })
                      : window.print()
                  }
                >
                  {window.leafDesktop ? 'Αποθήκευση PDF' : 'Εκτύπωση / Αποθήκευση ως PDF'}
                </button>
              ) : (
                <button disabled={busy} className="primary" onClick={() => action(preparePrint)}>
                  Προετοιμασία PDF
                </button>
              )}
              <button onClick={() => setFull(false)}>Κλείσιμο ×</button>
            </div>
          </header>
          <p className="print-help">
            {window.leafDesktop
              ? 'Πατήστε «Αποθήκευση PDF» και επιλέξτε τον φάκελο προορισμού.'
              : 'Στο παράθυρο εκτύπωσης επιλέξτε «Αποθήκευση ως PDF», οριζόντιο προσανατολισμό, χωρίς περιθώρια και χωρίς κεφαλίδες/υποσέλιδα. Ενεργοποιήστε τα γραφικά φόντου.'}
          </p>
          <div className="full-pages">
            {pages.map((page, i) => (
              <div key={i}>
                <small>
                  ΣΕΛΙΔΑ {i + 1} · {pageLabel(page)}
                </small>
                <ScaledSlide>
                  <Slide page={page} project={project} number={i + 1} />
                </ScaledSlide>
              </div>
            ))}
          </div>
        </div>
      )}
      <div ref={deckRef}>
        <PrintDeck project={project} />
      </div>
    </>
  );
}
