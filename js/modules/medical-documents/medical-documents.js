import { Repository, makeId } from "../../db/repository.js";
import { isViewerMode } from "../../view-mode.js";
import { escapeHtml } from "../../utils/dom.js";

const repo = new Repository("medical_documents");

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("No s'ha pogut llegir el fitxer."));
    reader.readAsDataURL(file);
  });
}

function formatDate(value) {
  if (!value) return "Sense data";
  const [y,m,d] = value.split("-");
  return y && m && d ? `${d}/${m}/${y}` : value;
}

function typeOptions(selected="") {
  return ["Analítica","Imatge / radiologia","Informe mèdic","Prova funcional","Anatomia patològica","Altres"]
    .map(x=>`<option value="${escapeHtml(x)}" ${selected===x?"selected":""}>${escapeHtml(x)}</option>`).join("");
}

function filesReadonly(files=[]) {
  if (!files.length) return `<p style="margin:6px 0 0;color:var(--ink-faint);font-size:var(--fs-xs);">Sense documents adjunts.</p>`;
  return `<div style="display:grid;gap:7px;margin-top:7px;">${files.map((f,i)=>`
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 10px;background:var(--paper-alt);border-radius:var(--radius-sm);">
      <div style="min-width:0;">
        <div style="font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">📎 ${escapeHtml(f.label||f.name||`Document ${i+1}`)}</div>
        ${f.label&&f.name&&f.label!==f.name?`<div style="font-size:11px;color:var(--ink-faint);margin-top:2px;">${escapeHtml(f.name)}</div>`:""}
      </div>
      ${f.dataUrl?`<a class="btn btn-ghost" href="${escapeHtml(f.dataUrl)}" download="${escapeHtml(f.name||"document")}" style="padding:5px 9px;flex-shrink:0;">Descarrega</a>`:""}
    </div>`).join("")}</div>`;
}


function readonlyCard(r, editable=false) {
  return `<article class="card medical-doc-card" data-document-id="${escapeHtml(r.id||"")}" style="margin-bottom:12px;overflow:hidden;padding:0;${editable?"cursor:pointer;":""}">
    <div style="height:5px;background:linear-gradient(90deg,#56758A,#8EA6B5);"></div>
    <div style="padding:16px;">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
        <div style="min-width:0;">
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:7px;">
            ${r.type?`<span class="badge" style="background:#E7EEF2;color:#456274;">${escapeHtml(r.type)}</span>`:""}
            ${r.area?`<span class="badge" style="background:#EEF0EA;color:#5F705A;">${escapeHtml(r.area)}</span>`:""}
          </div>
          <h2 class="card-title" style="margin:0;font-size:20px;">${escapeHtml(r.title||"Informe o resultat")}</h2>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">
          <div style="padding:7px 10px;border:1px solid var(--line);border-radius:999px;font-size:var(--fs-xs);color:var(--ink-soft);font-weight:700;background:var(--paper-alt);">${escapeHtml(formatDate(r.date))}</div>
          ${editable?`<button class="btn btn-ghost md-edit" type="button">Edita</button>`:""}
        </div>
      </div>

      ${(r.reason||r.center||r.result||r.notes)?`<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px;">
        ${r.reason?`<div style="padding:10px 12px;background:var(--paper-alt);border-radius:10px;"><div style="font-size:11px;color:var(--ink-faint);font-weight:700;text-transform:uppercase;letter-spacing:.05em;">Motiu</div><div style="margin-top:4px;color:var(--ink-soft);">${escapeHtml(r.reason)}</div></div>`:""}
        ${r.center?`<div style="padding:10px 12px;background:var(--paper-alt);border-radius:10px;"><div style="font-size:11px;color:var(--ink-faint);font-weight:700;text-transform:uppercase;letter-spacing:.05em;">Centre o professional</div><div style="margin-top:4px;color:var(--ink-soft);">${escapeHtml(r.center)}</div></div>`:""}
        ${r.result?`<div style="padding:10px 12px;background:var(--paper-alt);border-radius:10px;grid-column:1/-1;"><div style="font-size:11px;color:var(--ink-faint);font-weight:700;text-transform:uppercase;letter-spacing:.05em;">Resultat / conclusió</div><div style="margin-top:4px;color:var(--ink-soft);">${escapeHtml(r.result)}</div></div>`:""}
        ${r.notes?`<div style="padding:10px 12px;background:var(--paper-alt);border-radius:10px;grid-column:1/-1;"><div style="font-size:11px;color:var(--ink-faint);font-weight:700;text-transform:uppercase;letter-spacing:.05em;">Notes</div><div style="margin-top:4px;color:var(--ink-soft);white-space:pre-wrap;">${escapeHtml(r.notes)}</div></div>`:""}
      </div>`:""}

      <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line);font-size:var(--fs-sm);">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <strong>Documents</strong>
          <span style="font-size:11px;color:var(--ink-faint);">${(r.attachments||[]).length} fitxer${(r.attachments||[]).length===1?"":"s"}</span>
        </div>
        ${filesReadonly(r.attachments||[])}
      </div>
    </div>
  </article>`;
}

function editorCard(r={}) {
  const files=r.attachments||[];
  return `<article class="card medical-doc-editor" data-id="${escapeHtml(r.id||"")}" style="overflow:hidden;padding:0;"><div style="height:5px;background:linear-gradient(90deg,#56758A,#8EA6B5);"></div><div style="padding:16px;">
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:10px;">
      <label class="field"><span class="field-label">Títol</span><input class="input md-title" value="${escapeHtml(r.title||"")}"></label>
      <label class="field"><span class="field-label">Data de la prova</span><input type="date" class="input md-date" value="${escapeHtml(r.date||"")}"></label>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;">
      <label class="field"><span class="field-label">Tipus de prova</span><input class="input md-type" list="md-type-options" value="${escapeHtml(r.type||"")}"><datalist id="md-type-options"><option value="Analítica"></option><option value="Ressonància magnètica"></option><option value="Ecografia"></option><option value="Radiografia"></option><option value="TAC / TC"></option><option value="Mamografia"></option><option value="Imatge / radiologia"></option><option value="Informe mèdic"></option><option value="Prova funcional"></option><option value="Anatomia patològica"></option><option value="Altres"></option></datalist></label>
      <label class="field"><span class="field-label">Àrea / especialitat</span><input class="input md-area" value="${escapeHtml(r.area||"")}"></label>
    </div>
    <label class="field" style="margin-top:16px;"><span class="field-label">Centre o professional <span style="font-weight:400;color:var(--ink-faint);">(opcional)</span></span><input class="input md-center" value="${escapeHtml(r.center||"")}"></label>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:18px;">
      <label class="field"><span class="field-label">Motiu</span><textarea class="input md-reason" rows="5" style="resize:vertical;">${escapeHtml(r.reason||"")}</textarea></label>
      <label class="field"><span class="field-label">Resultat / conclusió</span><textarea class="input md-result" rows="5" style="resize:vertical;">${escapeHtml(r.result||"")}</textarea></label>
    </div>

    <label class="field" style="margin-top:18px;"><span class="field-label">Notes</span><textarea class="input md-notes" rows="4" style="resize:vertical;">${escapeHtml(r.notes||"")}</textarea></label>

    <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line);">
      <div style="font-weight:700;font-size:var(--fs-sm);margin-bottom:8px;">Documents adjunts</div>
      <label class="btn btn-ghost" style="cursor:pointer;">Selecciona fitxers<input class="md-file" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.txt" style="display:none;"></label>
      <div class="md-files" style="display:grid;gap:7px;margin-top:8px;">
        ${files.map((f,i)=>`<div class="md-file-row" data-index="${i}" style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end;padding:9px 10px;background:var(--paper-alt);border-radius:var(--radius-sm);">
          <div>
            <label style="font-size:11px;color:var(--ink-soft);">Nom del document</label>
            <input class="input md-file-label" data-index="${i}" value="${escapeHtml(f.label||f.name||`Document ${i+1}`)}" style="width:100%;padding:7px 8px;">
            <div style="font-size:11px;color:var(--ink-faint);margin-top:3px;">Fitxer original: ${escapeHtml(f.name||"")}</div>
          </div>
          <span style="display:flex;gap:6px;"><a class="btn btn-ghost" href="${escapeHtml(f.dataUrl||"#")}" download="${escapeHtml(f.name||"document")}" style="padding:6px 8px;">Descarrega</a><button class="btn btn-ghost md-remove-file" type="button" data-index="${i}" style="padding:6px 8px;">Elimina</button></span>
        </div>`).join("")}
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-top:14px;flex-wrap:wrap;">
      <span class="md-state" style="font-size:var(--fs-xs);color:var(--ink-faint);"></span>
      <div style="display:flex;gap:8px;"><button class="btn btn-ghost md-cancel" type="button">Cancel·la</button><button class="btn btn-ghost md-delete" type="button">Elimina registre</button><button class="btn btn-primary md-save" type="button">Desa</button></div>
    </div>
  </div></article>`;
}

export async function renderMedicalDocuments(container) {
  const viewer=isViewerMode();
  const rows=(await repo.getAll()).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  container.innerHTML=`
    <div class="view-header" style="align-items:flex-end;">
      <div>
        <p class="view-eyebrow">Historial documental</p>
        <h1 class="view-title">Informes i resultats</h1>
        <p class="view-subtitle">Proves, informes i resultats mèdics ordenats en un sol lloc.</p>
      </div>
      ${viewer?"":`<button class="btn btn-primary" id="md-add" type="button">+ Afegir informe o resultat</button>`}
    </div>

    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:14px;">
      <div class="card" style="padding:14px;border-left:3px solid #56758A;">
        <div style="font-size:11px;color:var(--ink-faint);text-transform:uppercase;letter-spacing:.08em;">Total</div>
        <div style="font-size:26px;font-weight:750;margin-top:3px;">${rows.length}</div>
        <div style="font-size:var(--fs-xs);color:var(--ink-soft);">registres desats</div>
      </div>
      <div class="card" style="padding:14px;border-left:3px solid #7C8F78;">
        <div style="font-size:11px;color:var(--ink-faint);text-transform:uppercase;letter-spacing:.08em;">Documents</div>
        <div style="font-size:26px;font-weight:750;margin-top:3px;">${rows.reduce((n,r)=>n+(r.attachments?.length||0),0)}</div>
        <div style="font-size:var(--fs-xs);color:var(--ink-soft);">fitxers adjunts</div>
      </div>
      <div class="card" style="padding:14px;border-left:3px solid #A57C63;">
        <div style="font-size:11px;color:var(--ink-faint);text-transform:uppercase;letter-spacing:.08em;">Últim registre</div>
        <div style="font-size:18px;font-weight:750;margin-top:6px;">${rows[0]?.date ? escapeHtml(formatDate(rows[0].date)) : "—"}</div>
        <div style="font-size:var(--fs-xs);color:var(--ink-soft);">data més recent</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:14px;padding:12px;background:var(--paper-alt);">
      <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(180px,.45fr);gap:8px;">
        <input class="input" id="md-search" placeholder="Cerca per títol, àrea, tipus o motiu">
        <select class="input" id="md-filter"><option value="">Tots els tipus</option>${typeOptions("")}</select>
      </div>
    </div>
    <div id="md-list">${rows.length?rows.map(r=>readonlyCard(r,!viewer)).join(""):`<div class="card"><p class="ledger-empty">Encara no hi ha informes o resultats desats.</p></div>`}</div>`;

  const list=container.querySelector("#md-list");
  const applyFilter=()=>{
    const q=(container.querySelector("#md-search")?.value||"").toLowerCase().trim();
    const type=container.querySelector("#md-filter")?.value||"";
    const filtered=rows.filter(r=>(!type||r.type===type)&&(!q||[r.title,r.type,r.area,r.reason,r.center,r.result,r.notes].join(" ").toLowerCase().includes(q)));
    list.innerHTML=filtered.length?filtered.map(r=>readonlyCard(r,!viewer)).join(""):`<div class="card"><p class="ledger-empty">No hi ha resultats amb aquests filtres.</p></div>`;
  };
  container.querySelector("#md-search")?.addEventListener("input",applyFilter);
  container.querySelector("#md-filter")?.addEventListener("change",applyFilter);

  if(viewer) return;

  container.querySelector("#md-add")?.addEventListener("click",()=>{
    list.innerHTML=editorCard({id:"",attachments:[]})+list.innerHTML;
    bindEditor(list.querySelector(".medical-doc-editor"),[]);
  });

  // Delegació d'esdeveniments: continua funcionant després de cercar o filtrar.
  list.addEventListener("click",async event=>{
    const card=event.target.closest(".medical-doc-card[data-document-id]");
    if(!card||!list.contains(card)) return;
    const editButton=event.target.closest(".md-edit");
    if(!editButton&&event.target.closest("a,button,input,textarea,select,label")) return;

    const record=await repo.get(card.dataset.documentId);
    if(!record){alert("No s'ha pogut trobar aquest informe o resultat.");return;}

    const template=document.createElement("template");
    template.innerHTML=editorCard(record).trim();
    const editor=template.content.firstElementChild;
    card.replaceWith(editor);
    bindEditor(editor,record.attachments||[]);
    editor.scrollIntoView({behavior:"smooth",block:"start"});
  });
}

function bindEditor(editor,initialAttachments=[]) {
  if(!editor) return;
  let attachments=initialAttachments.map(file=>({...file}));
  let persisted=Boolean(editor.dataset.id);
  const id=editor.dataset.id||makeId();
  editor.dataset.id=id;

  const data=()=>({
    id,
    title:editor.querySelector(".md-title").value.trim(),
    date:editor.querySelector(".md-date").value,
    type:editor.querySelector(".md-type").value,
    area:editor.querySelector(".md-area").value.trim(),
    reason:editor.querySelector(".md-reason").value.trim(),
    center:editor.querySelector(".md-center").value.trim(),
    result:editor.querySelector(".md-result").value.trim(),
    notes:editor.querySelector(".md-notes").value.trim(),
    attachments
  });

  editor.querySelector(".md-file")?.addEventListener("change",async e=>{
    const files=[...(e.target.files||[])];
    if(attachments.length+files.length>20){alert("Pots adjuntar un màxim de 20 fitxers per registre.");return;}
    const state=editor.querySelector(".md-state"); state.textContent="Preparant fitxers…";
    try{
      for(const file of files){
        if(file.size>10*1024*1024) throw new Error(`"${file.name}" supera els 10 MB.`);
        attachments.push({name:file.name,label:file.name,type:file.type,size:file.size,dataUrl:await fileToDataUrl(file),addedAt:new Date().toISOString()});
      }
      await repo.put(data());
      persisted=true;
      state.textContent="Fitxers desats ✓";
      await renderMedicalDocuments(editor.closest("#view-content")||editor.parentElement.parentElement);
    }catch(err){console.error(err);alert(err.message||"No s'han pogut afegir els fitxers.");state.textContent="";}
  });

  editor.querySelector(".md-save")?.addEventListener("click",async()=>{
    const state=editor.querySelector(".md-state"); state.textContent="Desant…";
    try{await repo.put(data()); persisted=true; state.textContent="Desat ✓"; setTimeout(()=>renderMedicalDocuments(editor.closest("#view-content")||editor.parentElement.parentElement),400);}
    catch(err){console.error(err);alert(err.message||"No s'ha pogut desar.");state.textContent="";}
  });

  editor.querySelector(".md-delete")?.addEventListener("click",async()=>{
    if(!persisted){editor.remove();return;}
    if(confirm("Vols eliminar aquest informe o resultat?")){await repo.delete(id);renderMedicalDocuments(editor.closest("#view-content")||editor.parentElement.parentElement);}
  });

  editor.querySelector(".md-cancel")?.addEventListener("click",()=>{
    renderMedicalDocuments(editor.closest("#view-content")||editor.parentElement.parentElement);
  });

  editor.querySelectorAll(".md-file-label").forEach(inp=>{
    const saveLabel=async()=>{
      const i=Number(inp.dataset.index);
      if(attachments[i]) attachments[i].label=inp.value.trim()||attachments[i].name;
      await repo.put(data());
      persisted=true;
    };
    inp.addEventListener("change",saveLabel);
    inp.addEventListener("blur",saveLabel);
  });
  editor.querySelectorAll(".md-remove-file").forEach(btn=>btn.addEventListener("click",async()=>{
    attachments.splice(Number(btn.dataset.index),1); await repo.put(data()); persisted=true; renderMedicalDocuments(editor.closest("#view-content")||editor.parentElement.parentElement);
  }));
}
