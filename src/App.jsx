import { useState, useRef, useEffect, useCallback, memo } from "react";
import JSZip from "jszip";

const PRESETS = [
  { label: "1:1",   w: 1,  h: 1  },
  { label: "4:3",   w: 4,  h: 3  },
  { label: "3:4",   w: 3,  h: 4  },
  { label: "16:9",  w: 16, h: 9  },
  { label: "9:16",  w: 9,  h: 16 },
  { label: "3:2",   w: 3,  h: 2  },
  { label: "2:3",   w: 2,  h: 3  },
];

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

const CropCanvas = memo(({ imgFile, aspectW, aspectH, onCropChange }) => {
  const canvasRef = useRef(null);
  const imgRef    = useRef(null);
  const S         = useRef({ dragging:false, resizing:false, handle:null, sx:0, sy:0, sc:null, crop:null, scale:1 });
  const raf       = useRef(null);

  useEffect(() => {
    const img = new window.Image();
    img.onload = () => { imgRef.current = img; initCanvas(img); };
    img.src    = imgFile.url;
    return () => { img.onload = null; };
  }, [imgFile.url]);

  useEffect(() => {
    if (!imgRef.current || !canvasRef.current) return;
    const { crop } = S.current;
    if (!crop) return;
    const canvas = canvasRef.current;
    if (aspectW && aspectH) {
      const ratio = aspectW / aspectH;
      const cw = canvas.width, ch = canvas.height;
      let nw = Math.min(crop.w, cw), nh = nw / ratio;
      if (nh > ch) { nh = ch; nw = nh * ratio; }
      S.current.crop = { x: clamp(crop.x, 0, cw - nw), y: clamp(crop.y, 0, ch - nh), w: nw, h: nh };
    }
    draw(); reportCrop();
  }, [aspectW, aspectH]);

  function initCanvas(img) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const par   = canvas.parentElement;
    const maxW  = (par?.clientWidth  || window.innerWidth  - 400) - 8;
    const maxH  = (par?.clientHeight || window.innerHeight - 140) - 8;
    const sc    = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight);
    S.current.scale  = sc;
    canvas.width  = Math.round(img.naturalWidth  * sc);
    canvas.height = Math.round(img.naturalHeight * sc);
    const cw = canvas.width, ch = canvas.height;
    let cW, cH;
    if (aspectW && aspectH) {
      const r = aspectW / aspectH;
      cW = Math.min(cw, ch * r); cH = cW / r;
      if (cH > ch) { cH = ch; cW = cH * r; }
    } else { cW = cw * 0.85; cH = ch * 0.85; }
    S.current.crop = { x: (cw - cW) / 2, y: (ch - cH) / 2, w: cW, h: cH };
    draw(); reportCrop();
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current, img = imgRef.current;
    if (!canvas || !img) return;
    const ctx   = canvas.getContext("2d");
    const { crop, scale } = S.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    if (!crop) return;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.clearRect(crop.x, crop.y, crop.w, crop.h);
    ctx.drawImage(img, crop.x/scale, crop.y/scale, crop.w/scale, crop.h/scale, crop.x, crop.y, crop.w, crop.h);
    ctx.strokeStyle = "#FF3333"; ctx.lineWidth = 1.5;
    ctx.strokeRect(crop.x, crop.y, crop.w, crop.h);
    ctx.strokeStyle = "rgba(255,51,51,0.3)"; ctx.lineWidth = 0.5;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(crop.x + crop.w*i/3, crop.y);   ctx.lineTo(crop.x + crop.w*i/3, crop.y + crop.h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(crop.x, crop.y + crop.h*i/3);   ctx.lineTo(crop.x + crop.w,     crop.y + crop.h*i/3); ctx.stroke();
    }
    handles(crop).forEach(h => { ctx.fillStyle = "#FF3333"; ctx.fillRect(h.x - 4, h.y - 4, 8, 8); });
    const iw = Math.round(crop.w / scale), ih = Math.round(crop.h / scale);
    ctx.fillStyle = "rgba(0,0,0,.7)"; ctx.fillRect(crop.x + 4, crop.y + 4, 94, 20);
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 11px 'DM Mono',monospace";
    ctx.fillText(`${iw} × ${ih}`, crop.x + 8, crop.y + 17);
  }, []);

  function handles(crop) {
    const { x, y, w, h } = crop;
    return [
      { id:"tl", x, y }, { id:"tc", x: x+w/2, y }, { id:"tr", x: x+w, y },
      { id:"ml", x, y: y+h/2 }, { id:"mr", x: x+w, y: y+h/2 },
      { id:"bl", x, y: y+h }, { id:"bc", x: x+w/2, y: y+h }, { id:"br", x: x+w, y: y+h },
    ];
  }
  function hitH(px, py, crop) { return handles(crop).find(h => Math.abs(h.x-px)<10 && Math.abs(h.y-py)<10); }

  function reportCrop() {
    const { crop, scale } = S.current;
    if (!crop) return;
    onCropChange({ x: crop.x/scale, y: crop.y/scale, w: crop.w/scale, h: crop.h/scale });
  }

  function pos(e) {
    const c = canvasRef.current, r = c.getBoundingClientRect();
    const sx = c.width/r.width, sy = c.height/r.height;
    const t  = e.touches ? e.touches[0] : e;
    return { x: (t.clientX - r.left)*sx, y: (t.clientY - r.top)*sy };
  }

  function onDown(e) {
    e.preventDefault();
    const { x, y } = pos(e), { crop } = S.current;
    if (!crop) return;
    const h = hitH(x, y, crop);
    if (h) { S.current.resizing = true; S.current.handle = h.id; }
    else if (x>=crop.x && x<=crop.x+crop.w && y>=crop.y && y<=crop.y+crop.h) S.current.dragging = true;
    S.current.sx = x; S.current.sy = y; S.current.sc = { ...crop };
  }

  function onMove(e) {
    e.preventDefault();
    const s = S.current;
    if (!s.dragging && !s.resizing) return;
    const { x, y } = pos(e);
    const dx = x - s.sx, dy = y - s.sy;
    const c  = canvasRef.current, cw = c.width, ch = c.height, sc = s.sc;
    if (s.dragging) {
      s.crop = { x: clamp(sc.x+dx, 0, cw-sc.w), y: clamp(sc.y+dy, 0, ch-sc.h), w: sc.w, h: sc.h };
    } else {
      let { x:nx, y:ny, w:nw, h:nh } = sc;
      const ratio = (aspectW && aspectH) ? aspectW/aspectH : 0;
      const hid = s.handle;
      if (hid.includes("r")) nw = clamp(sc.w+dx, 20, cw-sc.x);
      if (hid.includes("l")) { nw = clamp(sc.w-dx, 20, sc.x+sc.w); nx = sc.x+sc.w-nw; }
      if (hid.includes("b")) nh = clamp(sc.h+dy, 20, ch-sc.y);
      if (hid.includes("t")) { nh = clamp(sc.h-dy, 20, sc.y+sc.h); ny = sc.y+sc.h-nh; }
      if (ratio) { if (hid==="tc"||hid==="bc") nw=nh*ratio; else { nh=nw/ratio; if (hid.includes("t")) ny=sc.y+sc.h-nh; } }
      s.crop = { x: clamp(nx,0,cw-10), y: clamp(ny,0,ch-10), w: Math.max(10,nw), h: Math.max(10,nh) };
    }
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => { draw(); reportCrop(); });
  }

  function onUp() { S.current.dragging = false; S.current.resizing = false; reportCrop(); }

  function moveCursor(e) {
    const canvas = canvasRef.current; if (!canvas) return;
    const { x, y } = pos(e), { crop } = S.current; if (!crop) return;
    const h  = hitH(x, y, crop);
    const cm = { tl:"nw-resize",tr:"ne-resize",bl:"sw-resize",br:"se-resize",tc:"n-resize",bc:"s-resize",ml:"w-resize",mr:"e-resize" };
    canvas.style.cursor = h ? (cm[h.id]||"crosshair")
      : (x>=crop.x && x<=crop.x+crop.w && y>=crop.y && y<=crop.y+crop.h ? "move" : "crosshair");
  }

  return (
    <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <canvas ref={canvasRef}
        style={{ display:"block", maxWidth:"100%", maxHeight:"100%", userSelect:"none", borderRadius:6, boxShadow:"0 2px 16px rgba(0,0,0,.12)" }}
        onMouseDown={onDown} onMouseMove={e=>{ onMove(e); moveCursor(e); }} onMouseUp={onUp} onMouseLeave={onUp}
        onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp} />
    </div>
  );
});

function RenameModal({ count, initialConfig, onClose, onApply }) {
  const [baseName,  setBaseName]  = useState(initialConfig?.baseName ?? "CropKit");
  const [startNum,  setStartNum]  = useState(initialConfig?.startNum ?? 1);
  const [digits,    setDigits]    = useState(initialConfig?.digits ?? 3);
  const [position,  setPosition]  = useState(initialConfig?.position ?? "suffix");
  const [separator, setSeparator] = useState(initialConfig?.separator ?? "_");
  const [rangeStr,  setRangeStr]  = useState(initialConfig?.rangeStr ?? "");

  function preview() {
    const num = String(startNum).padStart(digits, "0");
    if (!baseName) return `${num}.ext`;
    return position === "prefix" ? `${num}${separator}${baseName}.ext` : `${baseName}${separator}${num}.ext`;
  }

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16 }}>
      <div style={{ background:"var(--surface)",border:"1px solid var(--border)",borderRadius:14,padding:28,width:400,maxWidth:"100%",boxShadow:"0 8px 32px rgba(0,0,0,.2)" }}>
        <div style={{ fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:800,marginBottom:22,color:"var(--text)" }}>Rename {count} files</div>
        <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
          <div><div className="lbl">Base name</div><input className="inp" value={baseName} onChange={e=>setBaseName(e.target.value)} placeholder="e.g. photo" /></div>
          <div style={{ display:"flex",gap:10 }}>
            <div style={{ flex:1 }}><div className="lbl">Start number</div><input className="inp" type="number" value={startNum} onChange={e=>setStartNum(+e.target.value)} min="0" /></div>
            <div style={{ flex:1 }}><div className="lbl">Pad digits</div><input className="inp" type="number" value={digits} onChange={e=>setDigits(Math.max(1,+e.target.value))} min="1" max="6" /></div>
          </div>
          <div>
            <div className="lbl">Number position</div>
            <div className="seg">
              <button className={position==="prefix"?"active":""} onClick={()=>setPosition("prefix")}>prefix — 001_name</button>
              <button className={position==="suffix"?"active":""} onClick={()=>setPosition("suffix")}>suffix — name_001</button>
            </div>
          </div>
          <div>
            <div className="lbl">Separator</div>
            <div className="seg">
              {[["_","_"],["-","-"],["","none"]].map(([v,l])=>(
                <button key={v} className={separator===v?"active":""} onClick={()=>setSeparator(v)}>{l}</button>
              ))}
            </div>
          </div>
          <div><div className="lbl">Range (blank = all, e.g. 1-50)</div><input className="inp" value={rangeStr} onChange={e=>setRangeStr(e.target.value)} placeholder="1-100" /></div>
          <div style={{ background:"var(--bg)",borderRadius:8,padding:"10px 14px",display:"flex",gap:10,alignItems:"center" }}>
            <span style={{ fontSize:11,color:"var(--text3)" }}>Preview:</span>
            <span style={{ fontSize:13,color:"#FF3333",fontFamily:"monospace" }}>{preview()}</span>
          </div>
        </div>
        <div style={{ display:"flex",gap:10,marginTop:22 }}>
          <button className="btn-ghost" style={{ flex:1 }} onClick={onClose}>Cancel</button>
          <button className="btn-main" style={{ flex:2 }} onClick={()=>onApply({ baseName,startNum,digits,position,separator,rangeStr })}>Apply</button>
        </div>
      </div>
    </div>
  );
}

function FolderModal({ onClose, onConfirm }) {
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16 }}>
      <div style={{ background:"var(--surface)",border:"1px solid var(--border)",borderRadius:14,padding:28,width:360,maxWidth:"100%",boxShadow:"0 8px 32px rgba(0,0,0,.2)" }}>
        <div style={{ fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:800,marginBottom:8,color:"var(--text)" }}>Include subfolders?</div>
        <div style={{ fontSize:13,color:"var(--text3)",marginBottom:22,lineHeight:1.8 }}>
          Your folder contains subfolders.<br/>Folder structure will be preserved inside the ZIP output.
        </div>
        <div style={{ display:"flex",gap:10 }}>
          <button className="btn-ghost" style={{ flex:1 }} onClick={()=>onConfirm(false)}>Top folder only</button>
          <button className="btn-main" style={{ flex:1 }} onClick={()=>onConfirm(true)}>Include subfolders</button>
        </div>
      </div>
    </div>
  );
}

function Logo({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <rect width="26" height="26" rx="6" fill="#FF3333"/>
      <rect x="4"  y="4"  width="8" height="8" rx="1.5" fill="#fff"/>
      <rect x="14" y="4"  width="8" height="8" rx="1.5" fill="#fff" opacity=".3"/>
      <rect x="4"  y="14" width="8" height="8" rx="1.5" fill="#fff" opacity=".3"/>
      <rect x="14" y="14" width="8" height="8" rx="1.5" fill="#fff"/>
    </svg>
  );
}

export default function CropKit() {
  const [images,       setImages]       = useState([]);
  const [activeIdx,    setActiveIdx]    = useState(0);
  const [preset,       setPreset]       = useState(null);
  const [customW,      setCustomW]      = useState("512");
  const [customH,      setCustomH]      = useState("512");
  const [pendingW,     setPendingW]     = useState("512");
  const [pendingH,     setPendingH]     = useState("512");
  const [sizeKey,      setSizeKey]      = useState(0);
  const [outputExt,    setOutputExt]    = useState("png");
  const [quality,      setQuality]      = useState(92);
  const [crops,        setCrops]        = useState({});
  const [processing,   setProcessing]   = useState(false);
  const [progress,     setProgress]     = useState(0);
  const [progressLabel,setProgressLabel]= useState("");
  const [done,         setDone]         = useState(false);
  const [dlMode,       setDlMode]       = useState("zip");
  const [showRename,   setShowRename]   = useState(false);
  const [renameConfig, setRenameConfig] = useState(null);
  const [pickOpen,     setPickOpen]     = useState(false);
  const [darkMode,     setDarkMode]     = useState(true);

  const fileRef   = useRef(null);
  const folderRef = useRef(null);
  const dropRef   = useRef(null);

  const outW    = parseInt(customW) || 512;
  const outH    = parseInt(customH) || 512;
  // Output size ALWAYS controls the crop aspect ratio — presets just set convenient W/H values
  const aspectW = outW;
  const aspectH = outH;
  const IMAGE_EXTS = /\.(jpe?g|png|webp|gif|bmp|avif|tiff?)$/i;

  function loadFiles(rawFiles) {
    const arr = [...rawFiles].filter(f =>
      f.type.startsWith("image/") || IMAGE_EXTS.test(f.name)
    );
    if (!arr.length) return;
    const collected = arr.map(f => ({
      url: URL.createObjectURL(f),
      name: f.name,
      file: f,
      w: 0,
      h: 0,
      relativePath: f.webkitRelativePath || f.name,
    }));
    collected.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    setImages(prev => [...prev, ...collected]);
    setActiveIdx(0);
    setCrops({});
    setDone(false);
  }

  function onFolderInput(e) {
    const files = e.target.files;
    if (!files.length) { e.target.value = ""; return; }
    loadFiles(files);
    e.target.value = "";
  }

  function onDrop(e) {
    e.preventDefault();
    dropRef.current?.classList.remove("drag-over");
    loadFiles(e.dataTransfer.files);
  }

  function removeImg(i) {
    setImages(p => p.filter((_, idx) => idx !== i));
    setCrops(p => {
      const n = {};
      Object.entries(p).forEach(([k, v]) => { const ki = +k; if (ki < i) n[ki] = v; else if (ki > i) n[ki-1] = v; });
      return n;
    });
    setActiveIdx(p => clamp(p, 0, Math.max(0, images.length - 2)));
  }

  function buildName(orig, i, cfg, ext) {
    if (!cfg) return orig.replace(/\.[^.]+$/, "") + "." + ext;
    let indices = images.map((_, j) => j);
    if (cfg.rangeStr?.includes("-")) {
      const [s, en] = cfg.rangeStr.split("-").map(n => parseInt(n) - 1);
      indices = indices.slice(s, en + 1);
    } else if (cfg.rangeStr) indices = indices.slice(0, parseInt(cfg.rangeStr));
    const rank = indices.indexOf(i);
    if (rank === -1) return orig.replace(/\.[^.]+$/, "") + "." + ext;
    const num = String(cfg.startNum + rank).padStart(cfg.digits, "0");
    if (!cfg.baseName) return `${num}.${ext}`;
    return cfg.position === "prefix"
      ? `${num}${cfg.separator}${cfg.baseName}.${ext}`
      : `${cfg.baseName}${cfg.separator}${num}.${ext}`;
  }

  async function renderCanvas(imgObj, cropData) {
    const el = new window.Image();
    await new Promise(r => { el.onload = r; el.src = imgObj.url; });
    // Export exactly what the user sees — actual crop dimensions, no scaling
    const tw = cropData ? Math.round(cropData.w) : el.naturalWidth;
    const th = cropData ? Math.round(cropData.h) : el.naturalHeight;
    const canvas = document.createElement("canvas");
    canvas.width = tw; canvas.height = th;
    const ctx = canvas.getContext("2d");
    if (cropData) ctx.drawImage(el, cropData.x, cropData.y, cropData.w, cropData.h, 0, 0, tw, th);
    else          ctx.drawImage(el, 0, 0, tw, th);
    return canvas;
  }

  async function downloadAll() {
    setProcessing(true); setProgress(0); setDone(false);
    const mime = outputExt==="png" ? "image/png" : outputExt==="webp" ? "image/webp" : outputExt==="avif" ? "image/avif" : "image/jpeg";
    const q    = (outputExt==="png"||outputExt==="avif") ? 1 : quality/100;

    if (dlMode === "zip") {
      const zip = new JSZip();
      for (let i = 0; i < images.length; i++) {
        setProgressLabel(`Rendering ${i+1} / ${images.length}`);
        const img    = images[i];
        const canvas = await renderCanvas(img, crops[i]);
        const blob   = await new Promise(r => canvas.toBlob(r, mime, q));
        const fname  = buildName(img.name, i, renameConfig, outputExt);
        const parts  = img.relativePath.split("/");
        const folder = parts.length > 1 ? parts.slice(0,-1).join("/") : "";
        folder ? zip.folder(folder).file(fname, blob) : zip.file(fname, blob);
        setProgress(Math.round((i+1)/images.length * 80));
      }
      setProgressLabel("Building ZIP…");
      const zipBlob = await zip.generateAsync(
        { type:"blob", compression:"DEFLATE", compressionOptions:{ level:6 } },
        m => setProgress(80 + Math.round(m.percent * 0.2))
      );
      const a = document.createElement("a"); a.href = URL.createObjectURL(zipBlob); a.download = "cropkit_export.zip"; a.click();
    } else {
      for (let i = 0; i < images.length; i++) {
        setProgressLabel(`Downloading ${i+1} / ${images.length}`);
        const canvas = await renderCanvas(images[i], crops[i]);
        await new Promise(r => canvas.toBlob(blob => {
          const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
          a.download = buildName(images[i].name, i, renameConfig, outputExt); a.click();
          setTimeout(r, 200);
        }, mime, q));
        setProgress(Math.round((i+1)/images.length*100));
      }
    }
    setProcessing(false); setDone(true); setProgressLabel("");
  }

  const activeImage = images[activeIdx];

  return (
    <div className={`ck-root${darkMode?" dark":""}`} style={{ minHeight:"100vh", height:"100vh", background:"var(--bg)", color:"var(--text)",
      fontFamily:"'DM Mono','Courier New',monospace", display:"flex", flexDirection:"column", overflow:"hidden" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:var(--bg2)}
        ::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}

        .ck-root{--bg:#f0f0f0;--bg2:#fafafa;--surface:#fff;--border:#e0e0e0;--border2:#ddd;--text:#111;--text2:#555;--text3:#888;--text4:#aaa;--text5:#ccc;--canvas-bg:#e8e8e8}
        .ck-root.dark{--bg:#1a1a1a;--bg2:#141414;--surface:#242424;--border:#333;--border2:#3a3a3a;--text:#eee;--text2:#bbb;--text3:#888;--text4:#666;--text5:#444;--canvas-bg:#111}

        .inp{background:var(--surface);border:1.5px solid var(--border2);border-radius:7px;color:var(--text);
          padding:7px 10px;font-family:inherit;font-size:12px;outline:none;width:100%;transition:border-color .15s}
        .inp:focus{border-color:#FF3333}
        .inp-sm{width:80px!important}

        .lbl{font-size:9px;letter-spacing:.12em;color:var(--text4);margin-bottom:6px;text-transform:uppercase;font-weight:500}

        .pill{display:inline-flex;align-items:center;padding:4px 12px;border-radius:100px;
          font-size:11px;cursor:pointer;border:1.5px solid var(--border2);background:var(--surface);
          color:var(--text3);transition:all .12s;font-family:inherit;white-space:nowrap}
        .pill:hover{border-color:var(--text3);color:var(--text)}
        .pill.active{background:#FF3333;border-color:#FF3333;color:#fff;font-weight:500}

        .btn-main{background:#FF3333;color:#fff;border:none;border-radius:8px;
          padding:10px 20px;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;
          transition:opacity .15s,transform .1s}
        .btn-main:hover{opacity:.85}
        .btn-main:active{transform:scale(.97)}
        .btn-main:disabled{opacity:.35;cursor:not-allowed}

        .btn-ghost{background:var(--surface);color:var(--text2);border:1.5px solid var(--border2);border-radius:8px;
          padding:8px 14px;font-size:12px;cursor:pointer;font-family:inherit;transition:all .12s;white-space:nowrap}
        .btn-ghost:hover{border-color:var(--text3);color:var(--text)}
        .btn-ghost:disabled{opacity:.35;cursor:not-allowed}

        .seg{display:flex;gap:2px;background:var(--bg);border:1.5px solid var(--border);border-radius:7px;padding:3px}
        .seg button{flex:1;padding:5px 7px;border:none;border-radius:5px;font-size:11px;
          cursor:pointer;font-family:inherit;background:transparent;color:var(--text3);transition:all .12s;white-space:nowrap}
        .seg button:hover{color:var(--text);background:var(--surface)}
        .seg button.active{background:#FF3333;color:#fff}

        .thumb-item{cursor:pointer;border:1.5px solid transparent;border-radius:5px;overflow:hidden;
          position:relative;aspect-ratio:1;background:var(--border);transition:border-color .1s;flex-shrink:0}
        .thumb-item:hover{border-color:var(--text3)}
        .thumb-item.active{border-color:#FF3333}
        .thumb-item img{width:100%;height:100%;object-fit:cover;display:block}
        .thumb-del{position:absolute;top:2px;right:2px;width:16px;height:16px;background:rgba(255,255,255,.92);
          border:none;border-radius:50%;color:#555;font-size:10px;cursor:pointer;display:flex;
          align-items:center;justify-content:center;opacity:0;transition:opacity .1s;line-height:1}
        .thumb-item:hover .thumb-del{opacity:1}
        .drag-over{border-color:#FF3333!important;background:rgba(255,51,51,0.06)!important}
        .divider{height:1px;background:var(--border);margin:0 -16px}

        .nav-btn{display:flex;align-items:center;justify-content:center;width:34px;height:34px;
          border:1.5px solid var(--border2);border-radius:8px;background:var(--surface);
          cursor:pointer;font-size:16px;color:var(--text2);transition:all .12s;flex-shrink:0}
        .nav-btn:hover:not(:disabled){border-color:var(--text3);color:var(--text)}
        .nav-btn:disabled{opacity:.3;cursor:not-allowed}

        .dm-btn{display:flex;align-items:center;justify-content:center;width:32px;height:32px;
          border:1.5px solid var(--border2);border-radius:8px;background:var(--surface);
          cursor:pointer;font-size:15px;transition:all .12s;flex-shrink:0}
        .dm-btn:hover{border-color:var(--text3)}

        @media(max-width:860px){ .side-panel{display:none!important} }
        @media(max-width:600px){ .thumb-col{width:96px!important} .header-title span.subtitle{display:none} }
      `}</style>

      {/* Header */}
      <div style={{ padding:"11px 18px", borderBottom:"1px solid var(--border)", background:"var(--surface)",
        display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0, gap:10 }}>
        <div className="header-title" style={{ display:"flex", alignItems:"center", gap:10 }}>
          <Logo size={26}/>
          <span style={{ fontFamily:"'Syne',sans-serif", fontSize:17, fontWeight:900, letterSpacing:"-.02em", color:"var(--text)" }}>CROPKIT</span>
          <span className="subtitle" style={{ fontSize:9, color:"var(--text5)", letterSpacing:".12em" }}>BATCH IMAGE STUDIO</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {images.length > 0 &&
            <span style={{ fontSize:10, color:"var(--text4)" }}>{images.length} images loaded</span>}
          <button className="dm-btn" onClick={()=>setDarkMode(d=>!d)} title={darkMode?"Light mode":"Dark mode"}>
            {darkMode ? "☀️" : "🌙"}
          </button>
        </div>
      </div>

      <div style={{ display:"flex", flex:1, overflow:"hidden", minHeight:0 }}>

        {/* Thumbnail strip */}
        <div className="thumb-col" style={{ width:128, background:"var(--bg2)", borderRight:"1px solid var(--border)",
          display:"flex", flexDirection:"column", flexShrink:0, overflow:"hidden" }}>
          <div style={{ flex:1, overflowY:"auto", padding:"7px", display:"flex", flexDirection:"column", gap:5 }}>
            <div ref={dropRef}
              onDragOver={e=>{ e.preventDefault(); dropRef.current?.classList.add("drag-over"); }}
              onDragLeave={()=>dropRef.current?.classList.remove("drag-over")}
              onDrop={onDrop}
              onClick={()=>setPickOpen(true)}
              style={{ border:"1.5px dashed var(--border2)", borderRadius:5, padding:"10px 5px",
                textAlign:"center", cursor:"pointer", fontSize:10, color:"var(--text5)",
                lineHeight:1.9, transition:"all .12s", marginBottom:3, background:"var(--surface)" }}>
              <div style={{ fontSize:16, marginBottom:2 }}>+</div>add
            </div>
            {images.map((img, ri) => (
              <div key={ri} className={`thumb-item ${ri===activeIdx?"active":""}`} onClick={()=>setActiveIdx(ri)}>
                <img src={img.url} alt={img.name} loading="lazy"/>
                <button className="thumb-del" onClick={e=>{ e.stopPropagation(); removeImg(ri); }}>×</button>
                {crops[ri] && <div style={{ position:"absolute",top:3,left:3,width:6,height:6,borderRadius:"50%",background:"#FF3333" }}/>}
                <div style={{ position:"absolute",bottom:0,left:0,right:0,background:"rgba(0,0,0,.55)",
                  fontSize:8,padding:"2px 4px",color:"#ddd",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                  {ri+1} · {img.name}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Canvas area */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:"var(--canvas-bg)" }}>
          {!activeImage ? (
            <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <div onDragOver={e=>e.preventDefault()} onDrop={onDrop} onClick={()=>setPickOpen(true)}
                style={{ border:"2px dashed var(--border)", borderRadius:18, padding:"56px 40px",
                  textAlign:"center", cursor:"pointer", maxWidth:420, background:"var(--surface)" }}>
                <Logo size={44}/>
                <div style={{ fontFamily:"'Syne',sans-serif",fontSize:24,fontWeight:900,color:"var(--border2)",margin:"14px 0 6px" }}>DROP CONTENT</div>
                <div style={{ fontSize:11,color:"var(--text4)",letterSpacing:".08em",marginBottom:8 }}>JPG · PNG · WebP · GIF · BMP · AVIF</div>
                <div style={{ fontSize:12,color:"var(--text5)" }}>or click here to select images or folder</div>
              </div>
            </div>
          ) : (
            <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
              {/* nav */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                padding:"7px 14px", background:"var(--surface)", borderBottom:"1px solid var(--border)", flexShrink:0, gap:10 }}>
                <div style={{ fontSize:10, color:"var(--text4)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>
                  {activeImage.relativePath !== activeImage.name
                    ? <span style={{ color:"var(--text3)" }}>{activeImage.relativePath.split("/").slice(0,-1).join("/")}/</span>
                    : null}
                  <span style={{ color:"var(--text)", fontWeight:500 }}>{activeImage.name}</span>
                  {activeImage.w > 0 && <span style={{ color:"var(--text5)" }}> {activeImage.w}×{activeImage.h}px</span>}
                </div>
                <div style={{ display:"flex", gap:6, alignItems:"center", flexShrink:0 }}>
                  <button className="nav-btn" disabled={activeIdx===0} onClick={()=>setActiveIdx(i=>i-1)}>‹</button>
                  <span style={{ fontSize:12, color:"var(--text3)", minWidth:52, textAlign:"center" }}>{activeIdx+1} / {images.length}</span>
                  <button className="nav-btn" disabled={activeIdx===images.length-1} onClick={()=>setActiveIdx(i=>i+1)}>›</button>
                </div>
              </div>
              {/* canvas fill */}
              <div style={{ flex:1, overflow:"hidden", padding:14 }}>
                <CropCanvas key={`${activeIdx}_${activeImage.url}_${preset?.label||"custom"}_${sizeKey}`}
                  imgFile={activeImage} aspectW={aspectW} aspectH={aspectH}
                  onCropChange={c=>{
                    setCrops(p=>({...p,[activeIdx]:c}));
                    setPendingW(String(Math.round(c.w)));
                    setPendingH(String(Math.round(c.h)));
                  }}/>
              </div>
              {crops[activeIdx] && (
                <div style={{ padding:"5px 14px 8px", fontSize:9, color:"var(--text4)", textAlign:"center",
                  flexShrink:0, background:"var(--surface)", borderTop:"1px solid var(--border)" }}>
                  export&nbsp;
                  <span style={{ color:"#FF3333",fontWeight:500 }}>{Math.round(crops[activeIdx].w)}×{Math.round(crops[activeIdx].h)}</span>
                  px
                </div>
              )}
            </div>
          )}
        </div>

        {/* Settings panel */}
        <div className="side-panel" style={{ width:272, background:"var(--surface)", borderLeft:"1px solid var(--border)",
          display:"flex", flexDirection:"column", flexShrink:0, overflow:"hidden" }}>
          <div style={{ flex:1, overflowY:"auto", padding:"16px 16px 0", display:"flex", flexDirection:"column", gap:18 }}>

            <div>
              <div className="lbl">Crop ratio shortcut</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                {PRESETS.map(p => (
                  <button key={p.label} className={`pill ${preset?.label===p.label?"active":""}`}
                    onClick={()=>{
                      setPreset(p);
                      const ratio = p.w / p.h;
                      const h = parseInt(pendingH) || 512;
                      const newW = String(Math.max(1, Math.round(h * ratio)));
                      setCustomW(newW); setPendingW(newW);
                      setCustomH(String(h)); setPendingH(String(h));
                      setSizeKey(k=>k+1);
                    }}>{p.label}</button>
                ))}
              </div>
              <div style={{ fontSize:9, color:"var(--text5)", marginTop:5 }}>sets output px to ratio · drag to reposition</div>
            </div>

            <div className="divider"/>

            <div>
              <div className="lbl">Output size (px) — updates live</div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <input className="inp inp-sm" type="number" min="1" value={pendingW}
                  onChange={e=>setPendingW(e.target.value)}
                  onKeyDown={e=>{ if(e.key==="Enter"){ const w=Math.max(1,parseInt(pendingW)||512); const h=Math.max(1,parseInt(pendingH)||512); setPreset(null); setCustomW(String(w)); setCustomH(String(h)); setPendingW(String(w)); setPendingH(String(h)); setSizeKey(k=>k+1); }}}/>
                <span style={{ color:"var(--text5)",fontSize:14,fontWeight:300 }}>×</span>
                <input className="inp inp-sm" type="number" min="1" value={pendingH}
                  onChange={e=>setPendingH(e.target.value)}
                  onKeyDown={e=>{ if(e.key==="Enter"){ const w=Math.max(1,parseInt(pendingW)||512); const h=Math.max(1,parseInt(pendingH)||512); setPreset(null); setCustomW(String(w)); setCustomH(String(h)); setPendingW(String(w)); setPendingH(String(h)); setSizeKey(k=>k+1); }}}/>
              </div>
              <button className="btn-main" style={{ width:"100%", marginTop:8, padding:"7px 12px", fontSize:11 }}
                onClick={()=>{
                  const w = Math.max(1, parseInt(pendingW)||512);
                  const h = Math.max(1, parseInt(pendingH)||512);
                  setPreset(null);
                  setCustomW(String(w)); setCustomH(String(h));
                  setPendingW(String(w)); setPendingH(String(h));
                  setSizeKey(k=>k+1);
                }}>
                Lock ratio &amp; reset crop
              </button>
              <div style={{ fontSize:9, color:"var(--text5)", marginTop:5 }}>type a size → lock ratio → drag freely within it</div>
            </div>

            <div className="divider"/>

            <div>
              <div className="lbl">Format</div>
              <div className="seg">
                {["jpg","png","webp","avif"].map(ext=>(
                  <button key={ext} className={outputExt===ext?"active":""} onClick={()=>setOutputExt(ext)}>.{ext}</button>
                ))}
              </div>
              {(outputExt==="jpg"||outputExt==="webp") && (
                <div style={{ marginTop:10 }}>
                  <div className="lbl">Quality — {quality}%</div>
                  <input type="range" min="60" max="100" value={quality} onChange={e=>setQuality(+e.target.value)} style={{ width:"100%",accentColor:"#FF3333" }}/>
                </div>
              )}
            </div>

            <div className="divider"/>

            <div>
              <div className="lbl">File naming</div>
              <div style={{ display:"flex",gap:7 }}>
                <button className="btn-ghost"
                  style={{ flex:1, ...(renameConfig ? { borderColor:"#FF3333", color:"#FF3333" } : {}) }}
                  onClick={()=>setShowRename(true)}>
                  {renameConfig ? `${renameConfig.position}: ${renameConfig.baseName||"original name"}` : "Set rename pattern"}
                </button>
                {renameConfig && <button className="btn-ghost" style={{ padding:"8px 10px" }} onClick={()=>setRenameConfig(null)}>✕</button>}
              </div>
              <div style={{ fontSize:9,color:"var(--text5)",marginTop:4 }}>
                {renameConfig
                  ? (renameConfig.baseName
                      ? `${renameConfig.position==="suffix" ? `name${renameConfig.separator}${"0".repeat(renameConfig.digits)}` : `${"0".repeat(renameConfig.digits)}${renameConfig.separator}name`} · ${renameConfig.rangeStr ? `range ${renameConfig.rangeStr}` : "all files"}`
                      : "no base name → keeps original filename + number")
                  : "No Base-Name Set → Keeps Original Filenames"}
              </div>
            </div>

            <div className="divider"/>

            <div>
              <div className="lbl">Download as</div>
              <div className="seg" style={{ marginBottom:12 }}>
                <button className={dlMode==="zip"?"active":""} onClick={()=>setDlMode("zip")}>ZIP archive</button>
                <button className={dlMode==="individual"?"active":""} onClick={()=>setDlMode("individual")}>Individual</button>
              </div>
              <button className="btn-main" disabled={images.length===0||processing} onClick={downloadAll}
                style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                {processing ? (progressLabel || "Processing…") : (<>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 1v8.5M8 9.5l-3-3M8 9.5l3-3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2 11.5v1A1.5 1.5 0 003.5 14h9a1.5 1.5 0 001.5-1.5v-1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  {dlMode==="zip" ? "Download ZIP" : "Download All"}
                </>)}
              </button>
              {processing && (
                <div style={{ height:3,background:"var(--border)",borderRadius:2,overflow:"hidden",marginTop:7 }}>
                  <div style={{ height:"100%",width:`${progress}%`,background:"#FF3333",transition:"width .2s" }}/>
                </div>
              )}
              {done && <div style={{ textAlign:"center",fontSize:10,color:"#FF3333",marginTop:7 }}>✓ Export complete</div>}
              {images.length > 0 && !processing && (
                <div style={{ textAlign:"center",fontSize:9,color:"var(--text5)",marginTop:5 }}>
                  {images.length} image{images.length!==1?"s":""}
                </div>
              )}
            </div>

          </div>

          <div style={{ height:16, flexShrink:0 }}/>
        </div>
      </div>

      <input ref={fileRef}   type="file" multiple accept="image/*" style={{ display:"none" }} onChange={e=>{ loadFiles(e.target.files); e.target.value=""; }}/>
      <input ref={folderRef} type="file" webkitdirectory="" mozdirectory="" style={{ display:"none" }} onChange={onFolderInput}/>

      {pickOpen && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300 }}
          onClick={()=>setPickOpen(false)}>
          <div style={{ background:"var(--surface)",border:"1px solid var(--border)",borderRadius:14,padding:24,display:"flex",gap:12,boxShadow:"0 8px 32px rgba(0,0,0,.2)" }}
            onClick={e=>e.stopPropagation()}>
            <button className="btn-ghost" style={{ width:140,height:90,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,fontSize:13 }}
              onClick={()=>{ setPickOpen(false); fileRef.current.click(); }}>
              <span style={{ fontSize:40 }}>🖼️</span>Select Images
            </button>
            <button className="btn-ghost" style={{ width:140,height:90,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,fontSize:13 }}
              onClick={()=>{ setPickOpen(false); folderRef.current.click(); }}>
              <span style={{ fontSize:40 }}>📁</span>Select Folder
            </button>
          </div>
        </div>
      )}

      {showRename && (
        <RenameModal count={images.length} initialConfig={renameConfig} onClose={()=>setShowRename(false)}
          onApply={cfg=>{ setRenameConfig(cfg); setShowRename(false); }}/>
      )}
    </div>
  );
}
