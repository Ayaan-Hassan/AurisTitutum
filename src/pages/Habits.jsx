import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import Icon from "../components/Icon";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { ConfirmModal, RenameModal } from "../components/Modals";
import HabitPerformanceModal from "../components/HabitPerformanceModal";
import { getLocalDateKey } from "../utils/date";


// ─── Timer Mode Component ──────────────────────────────────────────────────
const TimerControl = ({ habitId, logActivity }) => {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds
  const intervalRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    if (running) {
      startTimeRef.current = Date.now() - elapsed * 1000;
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 500);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const handleStop = () => {
    setRunning(false);
    if (elapsed > 0) {
      logActivity(habitId, true, elapsed, "sec");
      setElapsed(0);
    }
  };

  const handleReset = () => {
    setRunning(false);
    setElapsed(0);
  };

  return (
    <div className="flex items-center gap-2 w-full">
      {/* Timer display */}
      <div className={`flex-1 font-mono text-lg font-bold tracking-wider rounded-xl border px-3 py-2 text-center transition-all ${running ? "border-accent/60 bg-accent/10 text-accent" : "border-border-color bg-bg-main text-text-primary"}`}>
        {formatTime(elapsed)}
      </div>
      {/* Start/Stop */}
      <button
        onClick={() => running ? handleStop() : setRunning(true)}
        className={`w-11 h-11 rounded-xl flex items-center justify-center border-2 transition-all font-bold text-xs ${running ? "bg-emerald-500/20 border-emerald-500/70 text-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.3)]" : "bg-accent text-bg-main border-accent hover:opacity-90"}`}
        title={running ? "Stop & Log" : "Start Timer"}
      >
        <Icon name={running ? "square" : "play"} size={14} />
      </button>
      {/* Reset */}
      {(elapsed > 0 || running) && (
        <button
          onClick={handleReset}
          className="w-11 h-11 rounded-xl flex items-center justify-center border border-border-color text-text-secondary hover:text-text-primary hover:border-text-secondary transition-all"
          title="Reset"
        >
          <Icon name="rotate-ccw" size={14} />
        </button>
      )}
    </div>
  );
};

// ─── Rating Mode Component ────────────────────────────────────────────────────
const RatingControl = ({ habitId, logActivity, logs }) => {
  const [hoveredStar, setHoveredStar] = useState(0);
  const todayKey = getLocalDateKey();
  const todayLog = (logs || []).find((l) => l.date === todayKey);
  // Once per day: read the most-recent rating entry for today directly from entries
  const todayEntries = todayLog?.entries || [];
  // entries are stored as "HH:MM:SS|value|stars" for rating mode
  const lastEntry = todayEntries[todayEntries.length - 1];
  const todayRating = lastEntry && typeof lastEntry === "string" && lastEntry.includes("|")
    ? Math.round(Number(lastEntry.split("|")[1]) || 0)
    : (todayLog?.count ? Math.min(5, Math.round(todayLog.count)) : 0);

  // Once per day: if already rated today, just show the rating
  if (todayRating > 0) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((v) => (
            <svg key={v} viewBox="0 0 24 24" className="w-5 h-5" fill={v <= todayRating ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.5}>
              <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
                className={v <= todayRating ? "text-amber-400" : "text-border-color"} />
            </svg>
          ))}
        </div>
        <span className="text-[10px] text-text-secondary font-mono uppercase tracking-widest">Rated today</span>
      </div>
    );
  }

  const displayRating = hoveredStar;
  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((val) => (
          <button
            key={val}
            onClick={() => logActivity(habitId, true, val, "stars")}
            onMouseEnter={() => setHoveredStar(val)}
            onMouseLeave={() => setHoveredStar(0)}
            className="flex-1 group transition-all hover:scale-110 active:scale-95"
            title={`Rate ${val} star${val !== 1 ? "s" : ""}`}
          >
            <svg viewBox="0 0 24 24" className="w-full" style={{ maxWidth: "32px", margin: "0 auto" }}
              fill={val <= displayRating ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.5}>
              <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
                className={val <= displayRating ? "text-amber-400" : "text-border-color group-hover:text-amber-300"} />
            </svg>
          </button>
        ))}
      </div>
      <p className="text-[10px] text-text-secondary text-center font-mono uppercase tracking-widest">Tap a star to rate today</p>
    </div>
  );
};

// ─── Photo Compression Utility ───────────────────────────────────────────────
const compressPhoto = (base64Str) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const MAX_SIZE = 1200;
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > MAX_SIZE) {
          height = Math.round(height * (MAX_SIZE / width));
          width = MAX_SIZE;
        }
      } else {
        if (height > MAX_SIZE) {
          width = Math.round(width * (MAX_SIZE / height));
          height = MAX_SIZE;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
  });
};

// ─── Upload Mode Component ───────────────────────────────────────────────────
const UploadControl = ({ habit, logActivity, onViewGallery }) => {
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const cameraRef = useRef(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [stream, setStream] = useState(null);
  const { uploadCooldown: cooldown, triggerUploadCooldown, isLiveMonitoring, setSessionStreamActive } = useAuth();

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const openDesktopCamera = async () => {
    if (cooldown > 0) return;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(s);
      setCameraOpen(true);
    } catch {
      fileInputRef.current?.click();
    }
  };

  const openMobileCamera = () => {
    if (cooldown > 0) return;
    cameraInputRef.current?.click();
  };

  useEffect(() => {
    if (cameraOpen && stream && cameraRef.current) {
      cameraRef.current.srcObject = stream;
    }
  }, [cameraOpen, stream]);

  const stopCamera = () => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setCameraOpen(false);
  };

  const capturePhoto = () => {
    if (!cameraRef.current || cooldown > 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = cameraRef.current.videoWidth;
    canvas.height = cameraRef.current.videoHeight;
    canvas.getContext("2d").drawImage(cameraRef.current, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
    triggerUploadCooldown();
    stopCamera();
    logActivity(habit.id, true, 1, "photo", dataUrl);
    if (isLiveMonitoring) setSessionStreamActive(true);
  };

  const handleFileUpload = (e) => {
    if (cooldown > 0) return;
    const file = e.target.files[0];
    if (!file) return;
    triggerUploadCooldown();
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const compressed = await compressPhoto(ev.target.result);
      logActivity(habit.id, true, 1, "photo", compressed);
      if (isLiveMonitoring) setSessionStreamActive(true);
    };
    reader.readAsDataURL(file);
    e.target.value = null;
  };

  const photoLogs = (habit.logs || []).flatMap((l) =>
    (l.entries || [])
      .filter((e) => typeof e === "string" && e.startsWith("data:image"))
      .map((img) => ({ date: l.date, img }))
  );

  return (
    <>
      {cameraOpen && (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center">
          <video ref={cameraRef} autoPlay playsInline className="w-full max-h-[70vh] object-contain" />
          <div className="flex gap-4 mt-6">
            <button
               onClick={capturePhoto}
               disabled={cooldown > 0}
               className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-2xl disabled:opacity-50"
            >
              <div className="w-12 h-12 rounded-full border-4 border-gray-300" />
            </button>
            <button onClick={stopCamera} className="px-6 py-3 rounded-xl bg-white/20 text-white font-bold">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex gap-2 w-full">
        <button
          onClick={isMobile ? openMobileCamera : openDesktopCamera}
          disabled={cooldown > 0}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-border-color bg-bg-main text-text-secondary hover:border-accent hover:text-accent transition-all text-xs font-bold disabled:opacity-50"
        >
          <Icon name="camera" size={14} />
          {cooldown > 0 ? `Wait ${cooldown}s` : "Camera"}
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={cooldown > 0}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-border-color bg-bg-main text-text-secondary hover:border-accent hover:text-accent transition-all text-xs font-bold disabled:opacity-50"
        >
          <Icon name="upload" size={14} />
          {cooldown > 0 ? `Wait ${cooldown}s` : "Upload"}
        </button>

        {photoLogs.length > 0 && (
          <button
            onClick={onViewGallery}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border-2 border-accent/40 bg-accent/10 text-accent transition-all text-xs font-bold"
          >
            <Icon name="image" size={13} />
            {photoLogs.length}
          </button>
        )}

        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileUpload} />
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
      </div>
    </>
  );
};

const CompareView = ({ firstLog, latestLog, habit, onClose }) => {
  const [exporting, setExporting] = useState(false);
  const [viewMode, setViewMode] = useState("slider"); // Default to slider
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef(null);

  const getDayNumber = (dateStr) => {
    if (!habit.createdAt || !dateStr) return null;
    const start = new Date(habit.createdAt.split('T')[0] + "T12:00:00");
    const end = new Date(dateStr + "T12:00:00");
    const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
    return diff + 1;
  };

  const day1 = getDayNumber(firstLog.date);
  const day2 = getDayNumber(latestLog.date);

  const exportComparison = async () => {
    setExporting(true);
    const firstImg = firstLog.img;
    const latestImg = latestLog.img;
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      
      const img1 = new Image();
      const img2 = new Image();
      
      await Promise.all([
        new Promise(r => { img1.onload = r; img1.src = firstImg; }),
        new Promise(r => { img2.onload = r; img2.src = latestImg; })
      ]);

      const w = 1200;
      const h = 1500; // 4:5 Aspect Ratio
      const padding = 120;
      const headerH = 600;
      const footerH = 300;
      
      const isSliderExport = viewMode === "slider";
      canvas.width = isSliderExport ? w + padding * 2 : w * 2 + padding * 3;
      canvas.height = h + headerH + footerH;
      
      // Professional Dark Background
      ctx.fillStyle = "#030303";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // --- BRANDING (Logo & Name) ---
      const logoBoxSize = 100;
      const logoX = canvas.width / 2;
      const logoY = 120;
      
      // Draw Black Background with White Square Center Logo
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(logoX - logoBoxSize/2, logoY - logoBoxSize/2, logoBoxSize, logoBoxSize);
      ctx.fillStyle = "#000000";
      ctx.fillRect(logoX - 40, logoY - 40, 80, 80);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(logoX - 15, logoY - 15, 30, 30);
      
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 44px Inter, sans-serif";
      ctx.letterSpacing = "10px";
      ctx.fillText("AURISTITUTUM | PRO", canvas.width / 2, logoY + 140);

      // --- HEADER TITLE ---
      ctx.font = "italic 900 110px Inter, sans-serif";
      ctx.letterSpacing = "-3px";
      ctx.globalAlpha = 1.0;
      ctx.fillText("TRANSFORMATION LOG", canvas.width / 2, logoY + 280);

      // --- PROGRESS INDICATORS ---
      const progressY = logoY + 420;
      ctx.font = "bold 55px Inter";
      
      if (isSliderExport) {
          ctx.fillStyle = "#ffffff";
          ctx.fillText(`DAY ${day1}`, canvas.width / 2 - 200, progressY);
          ctx.fillStyle = "#4ade80";
          ctx.font = "70px Inter";
          ctx.fillText("→", canvas.width / 2, progressY + 5);
          ctx.fillStyle = "#4ade80";
          ctx.font = "bold 55px Inter";
          ctx.fillText(`DAY ${day2}`, canvas.width / 2 + 200, progressY);
      } else {
          ctx.fillStyle = "#ffffff";
          ctx.fillText(`DAY ${day1}`, padding + w/2, progressY);
          ctx.fillStyle = "#4ade80";
          ctx.font = "70px Inter";
          ctx.fillText("→", padding + w + padding/2, progressY + 5);
          ctx.fillStyle = "#4ade80";
          ctx.font = "bold 55px Inter";
          ctx.fillText(`DAY ${day2}`, padding * 2 + w + w/2, progressY);
      }

      const drawImg = (img, x, y, width, height, clipX = 0, clipW = 1) => {
          ctx.save();
          const radius = 60;
          ctx.beginPath();
          ctx.roundRect(x, y, width, height, radius);
          ctx.clip();

          // Standardized 'Equal Size' logic (Object-cover)
          const imgAspect = img.width / img.height;
          const targetAspect = width / height;
          let sw, sh, sx, sy;
          if (imgAspect > targetAspect) {
              sh = img.height;
              sw = img.height * targetAspect;
              sx = (img.width - sw) / 2;
              sy = 0;
          } else {
              sw = img.width;
              sh = img.width / targetAspect;
              sx = 0;
              sy = (img.height - sh) / 2;
          }

          const finalSx = sx + (clipX * sw);
          const finalSw = sw * clipW;
          const finalDx = x + (clipX * width);
          const finalDw = width * clipW;

          ctx.drawImage(img, finalSx, sy, finalSw, sh, finalDx, y, finalDw, height);
          ctx.restore();
          
          ctx.strokeStyle = "rgba(255,255,255,0.08)";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.roundRect(x, y, width, height, radius);
          ctx.stroke();
      };

      if (isSliderExport) {
          drawImg(img2, padding, headerH, w, h);
          drawImg(img1, padding, headerH, w, h, 0, 0.5);
          // Divider
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 10;
          ctx.beginPath();
          ctx.moveTo(canvas.width / 2, headerH);
          ctx.lineTo(canvas.width / 2, headerH + h);
          ctx.stroke();
      } else {
          drawImg(img1, padding, headerH, w, h);
          drawImg(img2, padding * 2 + w, headerH, w, h);
      }
      
      // Footer
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = 0.4;
      ctx.font = "bold 44px Inter";
      ctx.letterSpacing = "6px";
      ctx.fillText(habit.name.toUpperCase(), canvas.width / 2, headerH + h + 180);

      const link = document.createElement("a");
      link.download = `AURISTITUTUM_LOG_${habit.name.replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL("image/png", 1.0);
      link.click();
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  const [isDragging, setIsDragging] = useState(false);

  const handleSliderMove = useCallback((e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const pos = (x / rect.width) * 100;
    setSliderPos(Math.max(0, Math.min(100, pos)));
  }, []);

  useEffect(() => {
    const onMove = (e) => isDragging && handleSliderMove(e);
    const onEnd = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onEnd);
      document.addEventListener("touchmove", onMove, { passive: false });
      document.addEventListener("touchend", onEnd);
    }
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onEnd);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
    };
  }, [isDragging, handleSliderMove]);

  return (
    <div className="fixed inset-0 z-[165] bg-black/98 backdrop-blur-3xl flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[98vw] lg:max-w-[1500px] flex flex-col items-center h-full max-h-[95vh]">
        
        <div className="w-full flex flex-col sm:flex-row justify-between items-center mb-10 px-4 gap-6 shrink-0">
           <div>
              <p className="text-[10px] font-black tracking-[0.5em] text-accent mb-1 uppercase opacity-60">Transformation Archive</p>
              <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">{habit.name}</h1>
           </div>
           
           <div className="flex items-center gap-4">
              <div className="flex bg-white/5 border border-white/10 p-1 rounded-2xl">
                 {[
                   { id: "side-by-side", icon: "columns", label: "Split" },
                   { id: "slider", icon: "sliders", label: "Slide" }
                 ].map(m => (
                   <button
                     key={m.id}
                     onClick={() => setViewMode(m.id)}
                     className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewMode === m.id ? 'bg-white text-black shadow-xl' : 'text-white/40 hover:text-white'}`}
                   >
                     <Icon name={m.icon} size={13} />
                     <span>{m.label}</span>
                   </button>
                 ))}
              </div>
              <button
                onClick={exportComparison}
                disabled={exporting}
                className="h-11 px-6 rounded-2xl bg-accent text-bg-main hover:opacity-90 font-black flex items-center gap-2.5 transition-all active:scale-95 disabled:opacity-50 text-[11px] uppercase tracking-widest shadow-lg shadow-accent/20"
              >
                <Icon name={exporting ? "loader" : "download"} size={16} className={exporting ? "animate-spin" : ""} />
                {exporting ? "Saving..." : "Export Image"}
              </button>
              <button onClick={onClose} className="w-11 h-11 rounded-2xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-center border border-white/10 transition-all">
                <Icon name="x" size={24} />
              </button>
           </div>
        </div>

        <div className="w-full flex-1 min-h-0 flex flex-col items-center justify-center">
           {viewMode === "side-by-side" && (
             <div className="w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16 items-start overflow-y-auto custom-scrollbar p-4 pb-16">
                <div className="flex flex-col items-stretch group relative">
                  <div className="mb-6 flex items-center justify-between px-6">
                     <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-white/30 font-black italic text-2xl border border-white/5">01</div>
                        <div>
                           <p className="text-[10px] font-black tracking-[0.3em] text-white/20 uppercase mb-0.5">Start point</p>
                           <p className="text-2xl font-black text-white italic tracking-tight">DAY {day1}</p>
                        </div>
                     </div>
                     <p className="text-xs font-mono text-white/10 font-bold bg-white/5 px-3 py-1 rounded-lg">{firstLog.date}</p>
                  </div>
                  <div className="aspect-[4/5] w-full max-h-[50vh] rounded-[3rem] overflow-hidden border border-white/5 bg-white/5 relative shadow-3xl transition-all duration-700 group-hover:border-white/20">
                      <img src={firstLog.img} alt="Before" className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
                     <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                  </div>
                </div>

                <div className="flex flex-col items-stretch group relative">
                  <div className="mb-6 flex items-center justify-between px-6">
                     <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-accent text-bg-main flex items-center justify-center font-black italic text-2xl shadow-[0_0_30px_rgba(var(--accent-rgb),0.3)]">L</div>
                        <div>
                           <p className="text-[10px] font-black tracking-[0.3em] text-accent/40 uppercase mb-0.5">Latest state</p>
                           <p className="text-2xl font-black text-accent italic tracking-tight">DAY {day2}</p>
                        </div>
                     </div>
                     <p className="text-xs font-mono text-accent/20 font-bold bg-accent/5 px-3 py-1 rounded-lg">{latestLog.date}</p>
                  </div>
                  <div className="aspect-[4/5] w-full max-h-[50vh] rounded-[3rem] overflow-hidden border-2 border-accent/20 bg-accent/5 relative shadow-[0_0_120px_rgba(var(--accent-rgb),0.1)] transition-all duration-700 group-hover:border-accent/40">
                      <img src={latestLog.img} alt="After" className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
                     <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
                  </div>
                </div>
             </div>
           )}

           {viewMode === "slider" && (
             <div className="flex flex-col items-center gap-8 w-full h-full max-h-[75vh]">
                <div 
                  ref={containerRef}
                  className="relative aspect-[4/5] h-full rounded-[4rem] overflow-hidden border border-white/10 group cursor-col-resize shadow-[0_0_100px_rgba(0,0,0,0.5)] bg-bg-sidebar select-none"
                  onMouseDown={(e) => { setIsDragging(true); handleSliderMove(e); }}
                  onTouchStart={(e) => { setIsDragging(true); handleSliderMove(e); e.preventDefault(); }}
                >
                   {/* Latest Image (Bottom) */}
                    <img src={latestLog.img} className="absolute inset-0 w-full h-full object-cover" alt="After" draggable={false} />
                   
                   {/* First Image (Clipped Layer) */}
                   <div 
                     className="absolute inset-0 overflow-hidden pointer-events-none" 
                     style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
                   >
                       <img src={firstLog.img} className="absolute inset-0 w-full h-full object-cover" alt="Before" draggable={false} />
                   </div>

                   {/* Vertical Line & Handle */}
                   <div 
                     className="absolute inset-y-0 z-20 w-1 bg-white shadow-[0_0_20px_rgba(0,0,0,0.5)] pointer-events-none"
                     style={{ left: `${sliderPos}%` }}
                   >
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-2xl border-4 border-black/10">
                         <Icon name="sliders" size={20} className="text-black rotate-90" />
                      </div>
                   </div>

                   {/* Indicators */}
                   <div className="absolute bottom-8 left-12 z-30 flex flex-col items-start pointer-events-none transform transition-all duration-500 group-hover:translate-x-2">
                       <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Before</p>
                       <p className="text-2xl font-black text-white italic">DAY {day1}</p>
                   </div>
                   <div className="absolute bottom-8 right-12 z-30 flex flex-col items-end pointer-events-none transform transition-all duration-500 group-hover:-translate-x-2 text-right">
                       <p className="text-[10px] font-black uppercase tracking-widest text-accent/40 mb-1">After</p>
                       <p className="text-2xl font-black text-accent italic">DAY {day2}</p>
                   </div>
                </div>
                <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.4em] animate-pulse">Drag to see transformation</p>
             </div>
           )}
        </div>

        <p className="mt-8 mb-6 text-[10px] font-black uppercase tracking-[0.8em] text-white/5 italic text-center shrink-0">Progress Verification Archive // {day2 - day1 + 1} Records</p>
      </div>
    </div>
  );
};

// --- Custom Override Log Modal ---
const AdminLogModal = ({ open, habit, onConfirm, onClose }) => {
  const [date, setDate] = useState(getLocalDateKey());
  const [time, setTime] = useState("");
  const [value, setValue] = useState(1);
  const [photoData, setPhotoData] = useState(null);
  const [timerValues, setTimerValues] = useState({ h: 0, m: 0, s: 0 });
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setDate(getLocalDateKey());
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour12: false }));
      setValue(habit?.mode === "rating" ? 5 : 1);
      setPhotoData(null);
      setTimerValues({ h: 0, m: 0, s: 0 });
    }
  }, [open, habit]);

  if (!open || !habit) return null;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const compressed = await compressPhoto(ev.target.result);
      setPhotoData(compressed);
    };
    reader.readAsDataURL(file);
  };

  const renderValueInput = () => {
    switch (habit.mode) {
      case "check":
        return (
          <div className="flex items-center gap-3 bg-bg-sidebar border border-border-color rounded-xl px-4 py-3 cursor-pointer" onClick={() => setValue(value ? 0 : 1)}>
            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${value ? 'bg-accent border-accent text-bg-main' : 'border-border-color'}`}>
              {value > 0 && <Icon name="check" size={14} />}
            </div>
            <span className="text-sm font-medium text-text-primary">Condition Met / Completed</span>
          </div>
        );
      case "rating":
        return (
          <div className="flex justify-center gap-2 py-2">
            {[1, 2, 3, 4, 5].map((v) => (
              <button
                key={v}
                onClick={() => setValue(v)}
                className="transition-transform hover:scale-110 active:scale-95"
              >
                <svg viewBox="0 0 24 24" className="w-8 h-8" fill={v <= value ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.5}>
                  <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
                    className={v <= value ? "text-amber-400" : "text-border-color"} />
                </svg>
              </button>
            ))}
          </div>
        );
      case "timer":
        return (
          <div className="grid grid-cols-3 gap-2">
            {['h', 'm', 's'].map((unit) => (
              <div key={unit}>
                <label className="text-[10px] text-text-secondary uppercase mb-1 block text-center">{unit === 'h' ? 'Hrs' : unit === 'm' ? 'Min' : 'Sec'}</label>
                <input
                  type="number"
                  min="0"
                  max={unit === 'h' ? 99 : 59}
                  value={timerValues[unit]}
                  onChange={(e) => setTimerValues(prev => ({ ...prev, [unit]: parseInt(e.target.value) || 0 }))}
                  className="w-full bg-bg-sidebar border border-border-color rounded-xl px-2 py-2.5 text-center text-sm font-mono text-text-primary"
                />
              </div>
            ))}
          </div>
        );
      case "upload":
        return (
          <div className="space-y-3">
            {photoData ? (
              <div className="relative aspect-square w-full rounded-2xl overflow-hidden border-2 border-accent">
                <img src={photoData} className="w-full h-full object-cover" alt="Preview" />
                <button onClick={() => setPhotoData(null)} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center backdrop-blur-md">
                  <Icon name="x" size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full aspect-square rounded-2xl border-2 border-dashed border-border-color hover:border-accent hover:bg-accent/5 transition-all flex flex-col items-center justify-center gap-2 group"
              >
                <div className="w-12 h-12 rounded-full bg-bg-sidebar flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Icon name="camera" className="text-text-secondary group-hover:text-accent" />
                </div>
                <span className="text-xs font-bold text-text-secondary uppercase tracking-widest">Select Image</span>
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>
        );
      case "count":
        return (
          <div className="flex gap-2">
            <input type="number" value={value} onChange={(e) => setValue(Number(e.target.value))} className="flex-1 bg-bg-sidebar border border-border-color rounded-xl px-4 py-2.5 outline-none text-text-primary font-mono" />
            <div className="bg-bg-sidebar border border-border-color rounded-xl px-4 py-2.5 text-text-secondary text-xs font-bold flex items-center uppercase tracking-widest">
              {habit.unit || 'Unit'}
            </div>
          </div>
        );
      default: // tap / quick
        return (
          <div className="space-y-2">
             <label className="text-[10px] text-text-secondary uppercase block mb-1">Impact Multiplier</label>
             <input type="number" min="1" value={value} onChange={(e) => setValue(parseInt(e.target.value) || 1)} className="w-full bg-bg-sidebar border border-border-color rounded-xl px-4 py-2.5 outline-none text-text-primary font-mono" />
          </div>
        );
    }
  };

  const handleConfirm = () => {
    let finalValue = value;
    if (habit.mode === "timer") {
      finalValue = timerValues.h * 3600 + timerValues.m * 60 + timerValues.s;
    }
    onConfirm(date, time, finalValue, photoData);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in" onClick={onClose}>
      <div className="bg-bg-main border border-border-color rounded-2xl w-full max-w-sm p-6 shadow-2xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="mb-6">
          <h3 className="text-xl font-bold flex items-center gap-2 text-accent">
            <Icon name="edit-3" size={18} /> Override Log
          </h3>
          <p className="text-sm text-text-secondary mt-1">Insert custom record for {habit.name}</p>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] mb-1.5 block">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-bg-sidebar border border-border-color rounded-xl px-4 py-2.5 outline-none text-text-primary text-sm" />
            </div>
            <div>
              <label className="text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] mb-1.5 block">Time</label>
              <input type="time" step="1" value={time} onChange={(e) => setTime(e.target.value)} className="w-full bg-bg-sidebar border border-border-color rounded-xl px-4 py-2.5 outline-none text-text-primary text-sm" />
            </div>
          </div>
          
          <div>
            <label className="text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] mb-1.5 block">
              {habit.mode === "upload" ? "Media Evidence" : habit.mode === "timer" ? "Duration" : habit.mode === "rating" ? "Star Rating" : "Value / Amount"}
            </label>
            {renderValueInput()}
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-8">
          <Button variant="ghost" onClick={onClose} className="rounded-xl grow">Cancel</Button>
          <Button 
            variant="primary" 
            onClick={handleConfirm} 
            className="rounded-xl grow shadow-lg shadow-accent/20"
            disabled={habit.mode === "upload" && !photoData}
          >
            Force Log
          </Button>
        </div>
      </div>
    </div>
  );
};

const SlideshowView = ({ photos, onClose }) => {
  const [index, setIndex] = useState(0);
  const [speed, setSpeed] = useState(2500);

  useEffect(() => {
    if (photos.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % photos.length);
    }, speed);
    return () => clearInterval(timer);
  }, [photos, speed]);

  return (
    <div className="fixed inset-0 z-[160] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center p-4">
      <div className="absolute top-6 right-6 flex items-center gap-4 z-[170]">
        <div className="flex bg-white/10 backdrop-blur-md rounded-xl p-1 border border-white/20">
          {[1000, 2500, 5000].map((s) => (
             <button
               key={s}
               onClick={() => setSpeed(s)}
               className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all ${speed === s ? 'bg-white text-black' : 'text-white/50 hover:text-white'}`}
             >
               {s === 1000 ? "Fast" : s === 2500 ? "Normal" : "Slow"}
             </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-md transition-all shadow-xl border border-white/10"
        >
          <Icon name="x" size={24} />
        </button>
      </div>

      <div className="absolute top-6 left-6 z-[160]">
        <p className="text-[10px] font-black tracking-[0.3em] uppercase text-white/50 mb-1">Slideshow</p>
        <p className="text-white font-mono font-bold text-xl">{index + 1} / {photos.length}</p>
        <p className="text-xs text-accent mt-1 font-bold">{photos[index].date}</p>
      </div>

      <div className="relative w-full max-w-4xl h-[70vh] flex items-center justify-center">
        <img
          key={index}
          src={photos[index].img}
          alt="Slideshow log"
          className="max-w-full max-h-full rounded-2xl object-contain shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/5 transition-all duration-700 animate-in zoom-in-95 fade-in"
        />
      </div>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-2.5 z-[160]">
         {photos.map((_, i) => (
            <button 
              key={i} 
              onClick={() => setIndex(i)}
              className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${i === index ? 'bg-accent scale-150 shadow-[0_0_10px_rgba(var(--accent-rgb),0.5)]' : 'bg-white/20 hover:bg-white/40'}`} 
            />
         ))}
      </div>
    </div>
  );
};

// ─── Gallery Modal ────────────────────────────────────────────────────────────
const GalleryModal = ({ open, habit, onClose, setHabits }) => {
  const [zoomedImg, setZoomedImg] = useState(null);
  const [mode, setMode] = useState("grid"); // "grid", "slideshow", "compare"
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    if (!open) {
      setMode("grid");
      return;
    }
    const onEsc = (e) => {
      if (e.key === "Escape") {
        if (mode !== "grid") setMode("grid");
        else if (zoomedImg) setZoomedImg(null);
        else if (deleteTarget) setDeleteTarget(null);
        else onClose?.();
      }
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose, zoomedImg, mode, deleteTarget]);

  if (!open || !habit) return null;

  const photoLogs = (habit.logs || []).flatMap((l) =>
    (l.entries || [])
      .filter((e) => typeof e === "string" && e.startsWith("data:image"))
      .map((img) => ({ date: l.date, img, logId: l.id }))
  ).sort((a, b) => a.date.localeCompare(b.date));

  const latestImg = photoLogs[0]?.img;
  const firstImg = photoLogs[photoLogs.length - 1]?.img;

  const { user, deleteLog } = useAuth();

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const entryImg = deleteTarget;
    setDeleteTarget(null);

    setHabits?.((prev) => prev.map((h) => {
        if (h.id !== habit.id) return h;
        const updatedLogs = (h.logs || []).map((l) => ({
          ...l,
          entries: (l.entries || []).filter((e) => e !== entryImg),
          count: Math.max(0, (l.entries || []).filter((e) => e !== entryImg).length),
        })).filter((l) => l.count > 0 || (l.entries || []).length > 0);
        return { ...h, logs: updatedLogs };
    }));
  };

  if (mode === "compare" && photoLogs.length >= 2) {
    return (
      <CompareView 
        latestLog={photoLogs[photoLogs.length - 1]} 
        firstLog={photoLogs[0]} 
        habit={habit} 
        onClose={() => setMode("grid")} 
      />
    );
  }

  if (mode === "slideshow" && photoLogs.length > 0) {
    return <SlideshowView photos={photoLogs} onClose={() => setMode("grid")} />;
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[130] h-full w-full" onClick={onClose} />
      <div className="fixed inset-0 z-[131] sm:p-4 flex items-center justify-center pointer-events-none">
        <div
          className="w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden rounded-[2rem] border border-border-color bg-bg-main shadow-2xl animate-in zoom-in-95 fade-in pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 sm:p-8 bg-accent-dim border-b border-border-color relative">
            <div className="absolute top-0 right-0 opacity-10 blur-3xl w-48 h-48 bg-accent rounded-full pointer-events-none" />
            <div className="relative z-10 mb-4 sm:mb-0">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-accent flex items-center gap-2 mb-2"><Icon name="image" size={14}/> Upload Gallery</p>
              <h3 className="text-2xl font-bold text-text-primary mb-1 tracking-tight">{habit.name}</h3>
              <p className="text-xs text-text-secondary font-mono bg-bg-main/50 inline-block px-2 py-1 rounded-md">{photoLogs.length} Total Captured</p>
            </div>
            <div className="flex items-center gap-3 relative z-10 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
               <Button
                 disabled={photoLogs.length < 2}
                 onClick={() => setMode("compare")}
                 variant="outline"
                 icon="sliders"
                 className="whitespace-nowrap rounded-xl text-xs uppercase tracking-widest font-bold bg-bg-main/50"
               >
                 Compare First / Last
               </Button>
               <Button
                 disabled={photoLogs.length < 1}
                 onClick={() => setMode("slideshow")}
                 variant="primary"
                 icon="play"
                 className="whitespace-nowrap rounded-xl text-xs uppercase tracking-widest font-bold shrink-0"
               >
                 Slideshow
               </Button>
               <button onClick={onClose} className="w-10 h-10 shrink-0 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/10 transition-all ml-auto sm:ml-2">
                 <Icon name="x" size={16} />
               </button>
            </div>
          </div>

          <div className="overflow-y-auto custom-scrollbar p-6 sm:p-8 flex-1">
            {photoLogs.length === 0 ? (
              <div className="text-center py-24 flex flex-col items-center justify-center">
                 <Icon name="camera-off" size={48} className="text-text-secondary/30 mb-4" />
                 <p className="text-sm font-medium text-text-secondary uppercase tracking-widest">No visual logs recorded yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {photoLogs.map((entry, idx) => (
                  <div key={idx} className="group relative rounded-2xl overflow-hidden border-2 border-border-color aspect-square bg-bg-sidebar cursor-pointer hover:border-accent transition-all hover:shadow-[0_8px_30px_rgba(255,255,255,0.1)] hover:-translate-y-1" onClick={() => setZoomedImg(entry.img)}>
                    <img src={entry.img} alt={`Log ${idx + 1}`} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute inset-x-0 bottom-0 p-3 flex items-end justify-between translate-y-2 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <p className="text-[10px] text-white font-mono font-bold tracking-wider">{entry.date}</p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(entry.img);
                        }}
                        className="w-8 h-8 rounded-xl bg-red-500/90 flex items-center justify-center transition-all hover:bg-red-500 hover:scale-110 text-white"
                        title="Delete photo"
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <ConfirmModal
            open={!!deleteTarget}
            title="Delete photo entry"
            message="Are you sure you want to remove this captured record? This will also update your habit progress for that day."
            confirmLabel="Delete"
            variant="danger"
            onConfirm={handleConfirmDelete}
            onCancel={() => setDeleteTarget(null)}
          />
        </div>
      </div>

      {/* Fullscreen Image Zoom Overlay */}
      {zoomedImg && (
        <div className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setZoomedImg(null)}>
          <button
            onClick={() => setZoomedImg(null)}
            className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-md transition-all z-[160]"
          >
            <Icon name="x" size={24} />
          </button>
          <img
            src={zoomedImg}
            alt="Zoomed log"
            className="max-w-[95vw] max-h-[90vh] rounded-2xl object-contain shadow-2xl transition-transform"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};

const Habits = ({ habits, setHabits, logActivity }) => {
  const [countInputs, setCountInputs] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [performanceTarget, setPerformanceTarget] = useState(null);
  const [galleryTarget, setGalleryTarget] = useState(null);
  const [adminLogTarget, setAdminLogTarget] = useState(null);
  const performanceHabit = habits.find((h) => h.id === performanceTarget) || null;
  const galleryHabit = habits.find((h) => h.id === galleryTarget) || null;
  const adminLogHabit = habits.find((h) => h.id === adminLogTarget) || null;
  const { user, deleteHabit, updateHabit, isAdmin } = useAuth();
  
  const togglePin = async (habitId, currentPinned) => {
    if (user) {
      await updateHabit(habitId, { isPinned: !currentPinned });
    } else {
      setHabits(prev => prev.map(h => h.id === habitId ? { ...h, isPinned: !currentPinned } : h));
    }
  };

  const sortedHabits = useMemo(() => {
    return [...habits].sort((a, b) => {
       if (a.isPinned && !b.isPinned) return -1;
       if (!a.isPinned && b.isPinned) return 1;
       return 0;
    });
  }, [habits]);

  return (
    <div className="page-fade space-y-10 pb-20">
      <div>
        <h2 className="text-3xl font-bold tracking-tighter text-text-primary">
          Habit Registry
        </h2>
        <p className="text-text-secondary text-sm mt-1">
          Manage, monitor and calibrate your active behavioral nodes.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {sortedHabits.map((h) => {
          const todayKey = getLocalDateKey();
          const checkedToday = (h.logs || []).some(
            (l) => l.date === todayKey && l.count > 0,
          );
          const isCheckMode = h.mode === "check";
          const isGood = h.type === "Good";

          const weeklyLogs = Array.from({ length: 7 }).map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            const dateStr = getLocalDateKey(d);
            return (h.logs || []).some((l) => l.date === dateStr && l.count > 0);
          });
          const weeklyTotal = weeklyLogs.filter(Boolean).length;
          const weeklyProgress = (weeklyTotal / 7) * 100;
          const isFull = weeklyTotal === 7;

          return (
            <Card
              key={h.id}
              className="flex flex-col justify-between relative overflow-hidden"
            >
              <div className={`absolute left-0 top-0 bottom-0 z-0 transition-[width] duration-1000 ease-out flex items-start overflow-hidden ${isGood ? "bg-success/5" : "bg-danger/5"}`} style={{ width: `${weeklyProgress}%` }}>
                  {isFull && (
                    <div className={`w-[200%] h-8 absolute top-[-10px] left-0 animate-wave rounded-[50%] ${isGood ? "bg-success/10" : "bg-danger/10"}`} />
                  )}
              </div>
              {/* Action buttons */}
              <div className="absolute top-0 right-0 p-6 flex gap-2 z-[30]">
                <Button
                  onClick={(e) => { e.stopPropagation(); setAdminLogTarget(h.id); }}
                  variant="outline"
                  size="sm"
                  className="w-8 h-8 p-0 rounded-lg flex items-center justify-center border border-border-color bg-bg-main hover:border-accent hover:text-accent transition-all"
                  title="Override Log"
                >
                  <Icon name="edit-3" size={13} />
                </Button>
                <Button
                  onClick={(e) => { e.stopPropagation(); togglePin(h.id, h.isPinned); }}
                  variant="outline"
                  size="sm"
                  className={`w-8 h-8 p-0 rounded-lg flex items-center justify-center border transition-all ${h.isPinned ? 'border-accent text-accent bg-accent/10 shadow-[0_0_10px_rgba(var(--accent-rgb),0.2)]' : 'border-border-color bg-bg-main hover:border-accent hover:text-accent'}`}
                  title={h.isPinned ? "Unpin habit" : "Pin habit to top"}
                >
                  <Icon name="pin" size={13} className={h.isPinned ? "rotate-45" : ""} />
                </Button>
                <Button
                  onClick={(e) => { e.stopPropagation(); setPerformanceTarget(h.id); }}
                  variant="outline"
                  size="sm"
                  icon="bar-chart-2"
                  className="w-8 h-8 p-0 rounded-lg flex items-center justify-center border border-border-color bg-bg-main hover:border-accent hover:text-accent transition-all"
                />
                <Button
                  onClick={(e) => { e.stopPropagation(); setRenameTarget({ id: h.id, name: h.name }); }}
                  variant="outline"
                  size="sm"
                  icon="pencil"
                  className="w-8 h-8 p-0 rounded-lg flex items-center justify-center border border-border-color bg-bg-main hover:border-accent hover:text-accent transition-all"
                />
                <Button
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(h.id); }}
                  variant="danger"
                  size="sm"
                  icon="trash"
                  className="w-8 h-8 p-0 rounded-lg flex items-center justify-center border border-border-color bg-bg-main hover:bg-danger/10 hover:text-danger transition-all"
                />
              </div>

              {/* Habit Header */}
              <div className="mb-8 relative z-10">
                {/* Icon / Emoji Box */}
                {h.emoji ? (
                  <div
                    className={`w-10 h-10 rounded-xl mb-4 flex items-center justify-center border ${h.type === "Good"
                      ? "bg-accent text-bg-main border-accent"
                      : "bg-bg-sidebar text-text-secondary border-border-color"
                      }`}
                  >
                    <span
                      className="text-lg leading-none"
                      style={{
                        filter: "grayscale(1) saturate(0) brightness(1.2)",
                        fontSize: "1.1rem"
                      }}
                    >
                      {h.emoji}
                    </span>
                  </div>
                ) : (
                  <div
                    className={`w-10 h-10 rounded-xl mb-4 flex items-center justify-center border ${h.type === "Good"
                      ? "bg-accent text-bg-main border-accent"
                      : "bg-bg-sidebar text-text-secondary border-border-color"
                      }`}
                  >
                    <Icon
                      name={h.mode === "timer" ? "timer" : h.mode === "rating" ? "star" : h.mode === "upload" ? "camera" : h.type === "Good" ? "check-circle" : "alert-circle"}
                      size={18}
                    />
                  </div>
                )}

                <h4 className="text-xl font-bold truncate max-w-[200px] mb-1 text-text-primary flex items-center gap-2">
                  {h.name}
                  {h.isPinned && <Icon name="pin" size={12} className="text-accent rotate-45" />}
                </h4>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${h.type === "Good"
                      ? "bg-accent-dim text-text-primary"
                      : "bg-bg-sidebar text-text-secondary"
                      }`}
                  >
                    {h.type} NODE
                  </span>
                  <div className="h-1 w-1 rounded-full bg-border-color"></div>
                  <span className="text-[9px] text-text-secondary uppercase font-mono tracking-tighter">
                    {h.mode === "check"
                      ? `${h.totalLogs} day(s) checked`
                      : h.mode === "quick"
                        ? `${h.totalLogs} log(s)`
                        : h.mode === "rating"
                          ? `${(h.logs || []).reduce((s, d) => s + (d.entries || []).length, 0)} log(s) · Stars`
                          : `${(h.logs || []).reduce((s, d) => s + (d.entries || []).length, 0)} log(s) · ${h.totalLogs} ${h.unit || (h.mode === "count" ? "Unit" : "")}`
                    }
                  </span>
                  {/* Mode badge */}
                  {(h.mode && h.mode !== "quick") && (
                    <>
                      <div className="h-1 w-1 rounded-full bg-border-color"></div>
                      <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-accent-dim text-text-secondary border border-border-color/50">
                        {h.mode}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Recent Activity — Last 7 Days */}
              <div className="mb-8 relative z-10">
                <p className="text-[9px] font-black text-text-secondary uppercase tracking-widest mb-3">
                  Recent Activity (Last 7 Days)
                </p>
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: 7 }).map((_, idx) => {
                    const d = new Date();
                    d.setDate(d.getDate() - (6 - idx));
                    const dateStr = getLocalDateKey(d);
                    const todayStr = getLocalDateKey();
                    const isToday = dateStr === todayStr;
                    const dayLabel = d.toLocaleDateString("en-US", {
                      weekday: "short",
                    });
                    const habitLogs = h.logs || [];
                    const hasActivity = habitLogs.some(
                      (l) => l.date === dateStr && (l.count || 0) > 0,
                    );

                    // Upload mode: show camera icon on active day
                    if (h.mode === "upload" && hasActivity) {
                      return (
                        <div key={dateStr} className="flex flex-col items-center gap-1.5">
                          <div className="w-full aspect-square rounded-lg border-2 border-accent/60 bg-accent/15 transition-all flex items-center justify-center">
                            <Icon name="camera" size={10} className="text-accent" />
                          </div>
                          <span className="text-[8px] font-mono text-text-secondary uppercase">{dayLabel}</span>
                        </div>
                      );
                    }

                    // Rating mode: show star count
                    if (h.mode === "rating" && hasActivity) {
                      const dayLog = habitLogs.find(l => l.date === dateStr);
                      return (
                        <div key={dateStr} className="flex flex-col items-center gap-1.5">
                          <div className="w-full aspect-square rounded-lg border-2 border-amber-400/60 bg-amber-400/15 transition-all flex items-center justify-center">
                            <span className="text-[9px] font-bold text-amber-400">{dayLog?.count || "★"}</span>
                          </div>
                          <span className="text-[8px] font-mono text-text-secondary uppercase">{dayLabel}</span>
                        </div>
                      );
                    }

                    // For check mode, apply distinctive green/red styling with tick/cross
                    if (isCheckMode && hasActivity) {
                      const checkGoodClass = isGood
                        ? "bg-emerald-500/25 border-emerald-500/70 shadow-sm"
                        : "bg-red-500/25 border-red-500/70 shadow-sm";
                      return (
                        <div
                          key={dateStr}
                          className="flex flex-col items-center gap-1.5"
                        >
                          <div
                            className={`w-full aspect-square rounded-lg border-2 transition-all flex items-center justify-center ${checkGoodClass}`}
                          >
                            {isGood ? (
                              <svg viewBox="0 0 10 10" className="w-3/5 h-3/5" fill="none">
                                <path d="M1.5 5L4 7.5L8.5 2.5" stroke="#4ade80" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 10 10" className="w-3/5 h-3/5" fill="none">
                                <path d="M2 2L8 8M8 2L2 8" stroke="#f87171" strokeWidth="1.6" strokeLinecap="round" />
                              </svg>
                            )}
                          </div>
                          <span className="text-[8px] font-mono text-text-secondary uppercase">{dayLabel}</span>
                        </div>
                      );
                    }

                    // Default styling
                    const boxClass =
                      isToday && hasActivity
                        ? "bg-white border-white shadow-sm dark:bg-accent dark:border-accent"
                        : hasActivity
                          ? h.type === "Good"
                            ? "bg-success border-success shadow-sm"
                            : "bg-danger border-danger shadow-sm"
                          : "bg-transparent border-border-color hover:border-text-secondary";

                    return (
                      <div key={dateStr} className="flex flex-col items-center gap-1.5">
                        <div className={`w-full aspect-square rounded-lg border-2 transition-all ${boxClass}`}></div>
                        <span className="text-[8px] font-mono text-text-secondary uppercase">{dayLabel}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Log Action Controls */}
              <div className="pt-6 border-t border-border-color flex items-center justify-between gap-2 flex-wrap relative z-10">
                {h.mode === "timer" ? (
                  <TimerControl habitId={h.id} logActivity={logActivity} />
                ) : h.mode === "count" ? (
                  <div className="flex items-center gap-1.5 p-1 bg-bg-main border border-border-color rounded-xl h-11">
                    <input
                      type="number"
                      min="1"
                      placeholder="0"
                      className="w-16 h-full rounded-lg bg-bg-main border-none text-center text-sm font-mono text-text-primary outline-none px-2"
                      value={countInputs[h.id] ?? ""}
                      onChange={(e) =>
                        setCountInputs((prev) => ({
                          ...prev,
                          [h.id]: e.target.value,
                        }))
                      }
                    />
                    <Button
                      onClick={() => {
                        const n = countInputs[h.id];
                        if (!n) return;
                        logActivity(h.id, false, Number(n), h.unit || "");
                        setCountInputs((prev) => ({ ...prev, [h.id]: "" }));
                      }}
                      disabled={!countInputs[h.id]}
                      variant="ghost"
                      size="iconLg"
                      icon="minus"
                      className="rounded-lg w-10 h-full text-text-secondary hover:bg-bg-sidebar hover:text-text-primary border border-transparent shadow-none"
                    />
                    <Button
                      onClick={() => {
                        const n = countInputs[h.id];
                        if (!n) return;
                        logActivity(h.id, true, Number(n), h.unit || "");
                        setCountInputs((prev) => ({ ...prev, [h.id]: "" }));
                      }}
                      disabled={!countInputs[h.id]}
                      variant="primary"
                      size="iconLg"
                      icon="plus"
                      className="rounded-lg w-10 h-full shadow-none border-t border-white/20"
                    />
                  </div>
                ) : h.mode === "check" ? (
                  /* ── Check Mode ── */
                  <button
                    onClick={() => logActivity(h.id, !checkedToday)}
                    className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border-2 text-xs font-bold uppercase tracking-widest transition-all ${checkedToday
                      ? isGood
                        ? "bg-emerald-500/20 border-emerald-500/70 text-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.2)]"
                        : "bg-red-500/20 border-red-500/70 text-red-400 shadow-[0_0_16px_rgba(239,68,68,0.2)]"
                      : "border-border-color text-text-secondary hover:border-text-secondary hover:bg-accent-dim"
                      }`}
                  >
                    {checkedToday ? (
                      isGood ? (
                        <>
                          <svg viewBox="0 0 16 16" width="16" height="16" fill="none">
                            <path d="M2.5 8.5L6 12L13.5 4" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Done Today
                        </>
                      ) : (
                        <>
                          <svg viewBox="0 0 16 16" width="16" height="16" fill="none">
                            <path d="M3 3L13 13M13 3L3 13" stroke="#f87171" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                          Logged
                        </>
                      )
                    ) : (
                      <>
                        <div className="w-4 h-4 rounded border-2 border-border-color flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-border-color" />
                        </div>
                        Mark Done
                      </>
                    )}
                  </button>
                ) : h.mode === "rating" ? (
                  <RatingControl habitId={h.id} logActivity={logActivity} logs={h.logs} />
                ) : h.mode === "upload" ? (
                  <UploadControl
                    habit={h}
                    logActivity={logActivity}
                    onViewGallery={() => setGalleryTarget(h.id)}
                  />
                ) : (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => logActivity(h.id, false)}
                      variant="outline"
                      size="iconLg"
                      icon="minus"
                      className="rounded-xl"
                    />
                    <Button
                      onClick={() => logActivity(h.id, true)}
                      variant="primary"
                      size="iconLg"
                      icon="plus"
                      className="rounded-xl"
                    />
                  </div>
                )}
              </div>
            </Card>
          );
        })}

        {/* Add Habit Node button */}
        <button
          onClick={() => document.dispatchEvent(new CustomEvent("showModal"))}
          className="glass-card border-dashed border-2 border-border-color rounded-3xl p-10 flex flex-col items-center justify-center group hover:border-text-secondary transition-all opacity-60 hover:opacity-100"
        >
          <div className="w-12 h-12 rounded-full bg-bg-sidebar flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Icon name="plus" className="text-text-secondary" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary">
            New Habit Node
          </p>
        </button>
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete habit"
        message="Are you sure you want to delete this habit? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={async () => {
          if (deleteTarget) {
            if (user) {
              await deleteHabit(deleteTarget);
            } else {
              setHabits(habits.filter((item) => item.id !== deleteTarget));
            }
            setDeleteTarget(null);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
      <RenameModal
        open={!!renameTarget}
        currentName={renameTarget?.name}
        onConfirm={async (newName) => {
          if (renameTarget?.id && newName) {
            if (user) {
              await updateHabit(renameTarget.id, { name: newName });
            } else {
              setHabits(
                habits.map((item) =>
                  item.id === renameTarget.id ? { ...item, name: newName } : item,
                ),
              );
            }
            setRenameTarget(null);
          }
        }}
        onCancel={() => setRenameTarget(null)}
      />
      <HabitPerformanceModal
        open={!!performanceTarget}
        habit={performanceHabit}
        onClose={() => setPerformanceTarget(null)}
      />
      <GalleryModal
        open={!!galleryTarget}
        habit={galleryHabit}
        onClose={() => setGalleryTarget(null)}
        setHabits={setHabits}
      />
      <AdminLogModal
        open={!!adminLogTarget}
        habit={adminLogHabit}
        onClose={() => setAdminLogTarget(null)}
        onConfirm={(date, time, value, photoData) => {
          if (adminLogHabit) {
            logActivity(adminLogHabit.id, true, value, adminLogHabit.unit, photoData, date, time);
            const toastEvent = new CustomEvent("showToast", {
              detail: { message: `Log Overridden: ${adminLogHabit.name}`, type: "success", id: Date.now() },
            });
            document.dispatchEvent(toastEvent);
          }
          setAdminLogTarget(null);
        }}
      />
    </div>
  );
};

export default Habits;
