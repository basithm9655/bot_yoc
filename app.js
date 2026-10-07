// ==============================================================================
// STUDENT ATTENDANCE PWA - APPLICATION ENGINE
// Powered by Supabase Free Tier
// ==============================================================================

const THEME = {
  accent: '#2F7FF5',
  light: '#529BF8',
  confetti: ['#2F7FF5', '#529BF8', '#70B4FF', '#FFFFFF', '#60A5FA', '#3B82F6']
};

// Global App State
const STATE = {
  supabase: null,
  isConfigured: false,
  isAuthenticated: false,
  currentUser: null, // { id, name, identifier, role, approval_status, email }
  currentScreen: 'login',
  todayMarked: false,
  todayAttendanceId: null,
  todayMarkedTime: '',
  activeHistoryFilter: 'all',
  historyRecords: [],
  // Admin State
  adminUsers: [],
  adminPendingUsers: [],
  adminAttendance: [],
  adminActiveTab: 'pending', // 'pending' (Approvals), 'rank' (Leaderboard), 'all', 'attendance'
  userToDelete: null,
  pwaInstallPrompt: null
};

// ------------------------------------------------------------------------------
// 1. SUPABASE CLIENT INITIALIZATION
// ------------------------------------------------------------------------------
function initSupabase() {
  if (STATE.supabase && STATE.isConfigured) return true;
  const config = window.getSupabaseConfig();
  if (config && config.isConfigured && window.supabase) {
    try {
      STATE.supabase = window.supabase.createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.localStorage
        }
      });
      STATE.isConfigured = true;

      // Listen for auth state changes across tabs or token refresh
      STATE.supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
          STATE.isAuthenticated = false;
          STATE.currentUser = null;
          showScreen('login');
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('✓ Supabase session token refreshed.');
        }
      });

      return true;
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
      STATE.isConfigured = false;
      return false;
    }
  } else {
    STATE.isConfigured = false;
    return false;
  }
}

// Global Online / Offline Network Status Monitoring
window.addEventListener('online', () => showToast('✓ Connected to internet'));
window.addEventListener('offline', () => showToast('Offline: Check connection'));

// ------------------------------------------------------------------------------
// 2. HELPER FUNCTIONS: DATES, FORMATTING & CHIME
// ------------------------------------------------------------------------------
function getTodayDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTimeString(isoString) {
  if (!isoString) return '--';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '--';
  }
}

function formatDateLabel(dateStr) {
  try {
    const parts = dateStr.split('-');
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  } catch (e) {
    return dateStr;
  }
}

function formatMonthHeader(dateStr) {
  try {
    const parts = dateStr.split('-');
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  } catch (e) {
    return 'Attendance Records';
  }
}

// Synthetic Glass Chime for Apple-like tactile audio feedback
function playChime(isPositive = true) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (isPositive) {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880.00, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.start();
      osc.stop(ctx.currentTime + 0.46);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(200, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.16);
    }
  } catch (e) {}
}

// Celebration Confetti
function triggerConfetti() {
  const canvas = document.getElementById('confettiCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;

  const particles = [];
  const colors = THEME.confetti;

  for (let i = 0; i < 45; i++) {
    particles.push({
      x: canvas.width / 2,
      y: canvas.height * 0.45,
      vx: (Math.random() - 0.5) * 11,
      vy: (Math.random() - 0.7) * 12 - 2,
      size: Math.random() * 5 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 12,
      alpha: 1,
      decay: Math.random() * 0.02 + 0.012
    });
  }

  let animId;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35;
      p.vx *= 0.98;
      p.rotation += p.rotSpeed;
      p.alpha -= p.decay;

      if (p.alpha > 0) {
        alive = true;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
        ctx.restore;
      }
    });

    if (alive) {
      animId = requestAnimationFrame(animate);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      cancelAnimationFrame(animId);
    }
  }
  animate();
}

function showToast(msg) {
  const toast = document.getElementById('toastMessage');
  const text = document.getElementById('toastText');
  if (!toast || !text) return;
  text.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.add('hidden');
  }, 2600);
}

// ------------------------------------------------------------------------------
// DEPARTMENT CODES & ROLL NUMBER AUTO-DETECTION (PSG Tech Mapping)
// ------------------------------------------------------------------------------
const DEPT_CODES = {
  // BACHELOR OF ENGINEERING (B.E.)
  'A': 'Automobile Engineering (B.E.)',
  'C': 'Civil Engineering (B.E.)',
  'D': 'Biomedical Engineering (B.E.)',
  'E': 'Electrical & Electronics Engineering (B.E.)',
  'L': 'Electronics & Communication Engineering (B.E.)',
  'M': 'Mechanical Engineering (B.E.)',
  'N': 'Computer Science AI & ML (B.E.)',
  'P': 'Production Engineering (B.E.)',
  'R': 'Robotics & Automation (B.E.)',
  'U': 'Instrumentation & Control Engineering (B.E.)',
  'Y': 'Metallurgical Engineering (B.E.)',
  'Z': 'Computer Science & Engineering (B.E.)',

  // BACHELOR OF TECHNOLOGY (B.Tech.)
  'B': 'Biotechnology (B.Tech.)',
  'H': 'Fashion Technology (B.Tech.)',
  'I': 'Information Technology (B.Tech.)',
  'T': 'Textile Technology (B.Tech.)',

  // BACHELOR OF SCIENCE (B.Sc.)
  'S': 'B.Sc. Applied Science',
  'X': 'Other B.Sc. programs',

  // MASTER OF ENGINEERING (M.E.)
  'AE': 'Automotive Engineering (M.E.)',
  'BT': 'Biotechnology (M.E.)',
  'CS': 'Computer Science (M.E.)',
  'ED': 'Engineering Design (M.E.)',
  'EE': 'Embedded & Real-Time Systems (M.E.)',
  'LN': 'VLSI Design (M.E.)',
  'LV': 'Communication Systems (M.E.)',
  'MD': 'Manufacturing Engineering / Mechanical Design (M.E.)',
  'MN': 'Mechatronics (M.E.)',
  'NB': 'Biometrics & Cybersecurity (M.E.)',
  'PP': 'Power Systems / Production (M.E.)',
  'SE': 'Structural Engineering (M.E.)',
  'TT': 'Textile Technology (M.E.)',
  'UC': 'Control Systems (M.E.)',
  'ZC': 'Computer Science & Engineering (M.E.)',

  // MASTER OF COMPUTER APPLICATIONS (MCA)
  'MX': 'MCA (Master of Computer Applications)',

  // MASTER OF SCIENCE (M.Sc.)
  'FD': 'M.Sc. Fashion Design',
  'SA': 'M.Sc. Applied Science',
  'XC': 'M.Sc. Chemistry',
  'XD': 'M.Sc. Data Science',
  'XT': 'M.Sc. Textile Science',
  'XW': 'M.Sc. (Other Programs)',

  // MASTER OF BUSINESS ADMINISTRATION (MBA)
  'GM': 'MBA General Management',
  'GW': 'MBA (Other Specializations)'
};

/**
 * Parses a PSG Tech roll number [Year: 2 digits][Dept Code: 1-2 letters][Student No: digits]
 * Examples: 23S042 -> Year 2023, B.Sc. Applied Science
 *           24Z105 -> Year 2024, Computer Science & Engineering
 */
function parseRollNumber(roll) {
  if (!roll) return null;
  const clean = roll.trim().toUpperCase();
  // Match 2 digits (Year) + 1 or 2 letters (Dept Code) + optional remaining digits
  const match = clean.match(/^(\d{2})([A-Z]{1,2})(\d*)$/);
  if (!match) return null;

  const yearDigits = match[1];
  const deptCode = match[2];
  const rollNum = match[3];

  const fullYear = `20${yearDigits}`;
  const deptName = DEPT_CODES[deptCode] || `Dept (${deptCode})`;

  return {
    raw: clean,
    year: fullYear,
    deptCode: deptCode,
    deptName: deptName,
    rollNum: rollNum
  };
}

/**
 * Live input handler for signupRoll input
 */
let userEditedDeptManually = false;
let userEditedYearManually = false;

function onUserEditDept(val) {
  userEditedDeptManually = true;
  const badgeDept = document.getElementById('rollDetectedDept');
  const autoBadge = document.getElementById('rollAutoBadge');
  const deptVal = (val || '').trim();
  if (badgeDept) {
    badgeDept.textContent = deptVal || 'Custom Department';
  }
  if (deptVal && autoBadge) {
    autoBadge.classList.remove('hidden');
  }
}

function onUserEditYear(val) {
  userEditedYearManually = true;
  const badgeYear = document.getElementById('rollDetectedYear');
  const autoBadge = document.getElementById('rollAutoBadge');
  const yearVal = (val || '').trim();
  if (badgeYear) {
    badgeYear.textContent = yearVal ? `${yearVal} Batch` : 'Batch';
  }
  if (yearVal && autoBadge) {
    autoBadge.classList.remove('hidden');
  }
}

let rollCheckDebounceTimer = null;
let isCurrentRollDuplicate = false;

// Check if a roll number is already registered in the system (Supabase)
async function checkRollUniquenessRemote(rollNo) {
  if (!rollNo || rollNo.length < 3) return { registered: false };
  if (!STATE.isConfigured && !initSupabase()) return { registered: false };

  const cleanRoll = rollNo.trim().toUpperCase();

  // 1. Try dedicated RPC function (fastest & security definer)
  try {
    const { data: rpcData, error: rpcErr } = await STATE.supabase.rpc('check_roll_registered', { p_roll_no: cleanRoll });
    if (!rpcErr && rpcData) {
      if (typeof rpcData === 'object' && rpcData.registered === true) {
        return { registered: true, details: rpcData };
      } else if (rpcData === true) {
        return { registered: true, details: { roll_no: cleanRoll } };
      }
    }
  } catch (e) {}

  // 2. Direct profiles query fallback
  try {
    const { data, error } = await STATE.supabase
      .from('profiles')
      .select('id, name, roll_no, department, batch_year')
      .ilike('roll_no', cleanRoll)
      .limit(1);

    if (!error && data && data.length > 0) {
      return { registered: true, details: data[0] };
    }
  } catch (e) {}

  // 3. Fallback: Check via get_login_email RPC
  try {
    const { data: emailData, error: emailErr } = await STATE.supabase.rpc('get_login_email', { p_identifier: cleanRoll });
    if (!emailErr && emailData) {
      const synthetic = (cleanRoll.toLowerCase().replace(/[^a-z0-9]/g, '') + '@attendance.local');
      if (emailData.toLowerCase() !== synthetic) {
        return { registered: true, details: { roll_no: cleanRoll, email: emailData } };
      }
    }
  } catch (e) {}

  return { registered: false };
}

function openDuplicateRollModal(specificRoll = '') {
  const rollInput = document.getElementById('signupRoll');
  const rollNo = (specificRoll || (rollInput ? rollInput.value : '') || '25U201').trim().toUpperCase();
  const modal = document.getElementById('duplicateRollModal');
  const modalRollElem = document.getElementById('dupModalRollNo');
  const callBtn = document.getElementById('dupModalCallAdminBtn');
  const adminPhone = (window.getAdminContactPhone ? window.getAdminContactPhone() : '+919876543210');

  if (modalRollElem) modalRollElem.textContent = rollNo;
  if (callBtn) {
    callBtn.href = `tel:${adminPhone.replace(/\s+/g, '')}`;
  }

  if (modal) {
    modal.classList.remove('hidden');
  }
}

function closeDuplicateRollModal() {
  const modal = document.getElementById('duplicateRollModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

function copyAdminDeleteRequest() {
  const rollInput = document.getElementById('signupRoll');
  const rollNo = (rollInput ? rollInput.value : '').trim().toUpperCase() || 'this roll number';
  const text = `Hello Club Admin, my roll number is ${rollNo}. Please delete my previous account in the Manavar Illam Attendance App so I can register fresh. Thank you!`;
  
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      const btnText = document.getElementById('dupModalCopyText');
      if (btnText) {
        const orig = btnText.textContent;
        btnText.textContent = "✓ Message Copied!";
        setTimeout(() => { btnText.textContent = orig; }, 2500);
      }
      showToast("✓ Copied request message to clipboard");
    }).catch(() => {
      fallbackCopyText(text);
    });
  } else {
    fallbackCopyText(text);
  }
}

function fallbackCopyText(text) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast("✓ Copied request message to clipboard");
  } catch (e) {
    showToast("Please message your admin with roll no: " + text);
  }
}

function goToLoginWithDuplicateRoll() {
  closeDuplicateRollModal();
  const rollInput = document.getElementById('signupRoll');
  const rollNo = (rollInput ? rollInput.value : '').trim().toUpperCase();
  showScreen('login');
  const loginInput = document.getElementById('loginIdentifier');
  if (loginInput && rollNo) {
    loginInput.value = rollNo;
    const loginPwd = document.getElementById('loginPassword');
    if (loginPwd) loginPwd.focus();
  }
}

function handleRollInput(val) {
  const rollInput = document.getElementById('signupRoll');
  const deptInput = document.getElementById('signupDept');
  const yearInput = document.getElementById('signupYear');
  const autoBadge = document.getElementById('rollAutoBadge');
  const checkIcon = document.getElementById('rollDetectCheck');
  const badgeDept = document.getElementById('rollDetectedDept');
  const badgeYear = document.getElementById('rollDetectedYear');
  const dupNotice = document.getElementById('duplicateRollInlineNotice');
  const dupInlineRollText = document.getElementById('dupInlineRollText');

  if (!val) {
    isCurrentRollDuplicate = false;
    if (dupNotice) dupNotice.classList.add('hidden');
    if (rollInput) rollInput.classList.remove('border-amber-500');
    if (autoBadge && !userEditedDeptManually) autoBadge.classList.add('hidden');
    if (checkIcon) checkIcon.classList.add('hidden');
    return;
  }

  const clean = val.trim().toUpperCase();
  if (rollInput && rollInput.value !== clean) {
    rollInput.value = clean;
  }

  const parsed = parseRollNumber(clean);
  if (parsed && parsed.deptName) {
    // Fill department if empty or if user hasn't typed a custom override
    if (deptInput && (!userEditedDeptManually || !deptInput.value.trim())) {
      deptInput.value = parsed.deptName;
    }
    // Fill year if empty or if user hasn't typed a custom override
    if (yearInput && (!userEditedYearManually || !yearInput.value.trim())) {
      yearInput.value = parsed.year;
    }
    if (badgeDept) badgeDept.textContent = deptInput ? deptInput.value : parsed.deptName;
    if (badgeYear) badgeYear.textContent = `${yearInput ? yearInput.value : parsed.year} Batch`;
    if (autoBadge) autoBadge.classList.remove('hidden');
    if (checkIcon && !isCurrentRollDuplicate) checkIcon.classList.remove('hidden');
  } else {
    if (checkIcon) checkIcon.classList.add('hidden');
    // If user has custom department/year, keep badge visible with their custom values
    if (deptInput && deptInput.value.trim()) {
      if (badgeDept) badgeDept.textContent = deptInput.value.trim();
      if (badgeYear) badgeYear.textContent = yearInput && yearInput.value.trim() ? `${yearInput.value.trim()} Batch` : 'Batch';
      if (autoBadge) autoBadge.classList.remove('hidden');
    } else {
      if (autoBadge) autoBadge.classList.add('hidden');
    }
  }

  // Live debounced check to verify this roll number isn't already registered
  clearTimeout(rollCheckDebounceTimer);
  rollCheckDebounceTimer = setTimeout(async () => {
    if (clean.length >= 4) {
      const check = await checkRollUniquenessRemote(clean);
      if (check.registered) {
        isCurrentRollDuplicate = true;
        if (dupNotice) dupNotice.classList.remove('hidden');
        if (dupInlineRollText) dupInlineRollText.textContent = clean;
        if (rollInput) rollInput.classList.add('border-amber-500');
        if (checkIcon) checkIcon.classList.add('hidden');
      } else {
        isCurrentRollDuplicate = false;
        if (dupNotice) dupNotice.classList.add('hidden');
        if (rollInput) rollInput.classList.remove('border-amber-500');
        if (parsed && parsed.deptName && checkIcon) checkIcon.classList.remove('hidden');
      }
    } else {
      isCurrentRollDuplicate = false;
      if (dupNotice) dupNotice.classList.add('hidden');
      if (rollInput) rollInput.classList.remove('border-amber-500');
    }
  }, 350);
}

function hideSplashScreen() {
  const splash = document.getElementById('appSplashScreen');
  if (splash) {
    splash.style.opacity = '0';
    setTimeout(() => {
      splash.classList.add('hidden');
    }, 350);
  }
}

function showGhostLoading(text = "Loading...") {
  const loader = document.getElementById('ghostGlobalLoader');
  const label = document.getElementById('ghostLoaderText');
  if (label) label.textContent = text;
  if (loader) {
    loader.classList.remove('hidden');
    requestAnimationFrame(() => {
      loader.style.opacity = '1';
    });
  }
}

function hideGhostLoading() {
  const loader = document.getElementById('ghostGlobalLoader');
  if (loader) {
    loader.style.opacity = '0';
    setTimeout(() => {
      loader.classList.add('hidden');
    }, 280);
  }
}

// Normalize email/phone/roll for standard Supabase Free Tier Auth
function normalizeAuthIdentifier(input, rollNo = '') {
  const trimmed = (input || '').trim();
  if (trimmed.includes('@')) {
    return {
      authEmail: trimmed.toLowerCase(),
      displayIdentifier: trimmed
    };
  }
  // User entered roll number or phone number
  const rawId = trimmed || rollNo || 'user';
  const clean = rawId.toLowerCase().replace(/[^a-z0-9]/g, '');
  return {
    authEmail: `${clean}@attendance.local`,
    displayIdentifier: trimmed || rollNo
  };
}

// ------------------------------------------------------------------------------
// 3. UI SCREEN NAVIGATION & TIME DISPLAY
// ------------------------------------------------------------------------------
function updateClock() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const timeElem = document.getElementById('statusBarTime');
  if (timeElem) timeElem.textContent = `${hours}:${minutes}`;
}
setInterval(updateClock, 1000);
updateClock();

function setupDateDisplay() {
  const dateElem = document.getElementById('displayDate');
  if (!dateElem) return;
  const now = new Date();
  const options = { weekday: 'long', day: 'numeric', month: 'long' };
  dateElem.textContent = now.toLocaleDateString('en-GB', options);
}

function updateDynamicIsland() {
  const dot = document.getElementById('islandDot');
  const text = document.getElementById('islandText');
  const ghost = document.getElementById('islandGhost');
  if (!dot || !text) return;

  if (STATE.todayMarked) {
    dot.className = "w-1.5 h-1.5 rounded-full bg-[#2F7FF5] shadow-[0_0_8px_#2F7FF5]";
    text.className = "tracking-tight text-white font-medium";
    text.textContent = "Present";
    if (ghost) ghost.className = "inline-flex items-center text-[#529BF8] drop-shadow-[0_0_8px_rgba(47,127,245,0.7)] scale-110 transition-transform";
  } else {
    dot.className = "w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse";
    text.className = "tracking-tight text-white/80 font-medium";
    text.textContent = "Not Marked";
    if (ghost) ghost.className = "inline-flex items-center text-white/40 transition-transform";
  }
}

function showScreen(screenId) {
  // For admin, daily attendance check-in is not needed (bypass directly to admin suite)
  if (STATE.currentUser && STATE.currentUser.role === 'admin') {
    if (screenId === 'attendance' || screenId === 'history') {
      screenId = 'admin';
    }
  }

  STATE.currentScreen = screenId;
  const screenIds = ['screenLogin', 'screenSignup', 'screenApproval', 'screenAttendance', 'screenHistory', 'screenAdmin'];
  
  screenIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  const targetMap = {
    'login': 'screenLogin',
    'signup': 'screenSignup',
    'approval': 'screenApproval',
    'attendance': 'screenAttendance',
    'history': 'screenHistory',
    'admin': 'screenAdmin'
  };

  const targetEl = document.getElementById(targetMap[screenId]);
  if (targetEl) {
    targetEl.classList.remove('hidden');
    if (screenId === 'attendance') {
      const stag1 = targetEl.querySelector('.anim-stagger-1');
      const stag2 = targetEl.querySelector('.anim-stagger-2');
      const stag3 = targetEl.querySelector('.anim-stagger-3');
      [stag1, stag2, stag3].forEach(el => {
        if (el) {
          el.style.animation = 'none';
          el.offsetHeight; /* trigger reflow */
          el.style.animation = '';
        }
      });
    } else if (screenId === 'signup') {
      const matchBox = document.getElementById('passwordMatchStatus');
      if (matchBox) matchBox.classList.add('hidden');
      const p1 = document.getElementById('signupPassword');
      const p2 = document.getElementById('signupConfirm');
      if (p1) p1.classList.remove('border-emerald-500', 'border-rose-500', 'border-amber-500');
      if (p2) p2.classList.remove('border-emerald-500', 'border-rose-500');
    }
  }

  const bottomNav = document.getElementById('bottomNav');
  const authToggleBtn = document.getElementById('authToggleBtn');
  const isAuthFlow = ['login', 'signup', 'approval'].includes(screenId);

  // Smoothly dissolve splash screen if visible
  hideSplashScreen();

  if (isAuthFlow) {
    if (bottomNav) bottomNav.classList.add('hidden');
    if (authToggleBtn) authToggleBtn.classList.add('hidden');
  } else {
    if (bottomNav) {
      bottomNav.classList.remove('hidden');
      updateNavIcons(screenId);
    }
    if (authToggleBtn) {
      authToggleBtn.classList.remove('hidden');
      authToggleBtn.textContent = "Logout";
      authToggleBtn.onclick = () => handleLogout();
    }
  }
}

function updateNavIcons(activeTab) {
  const attendanceBtn = document.getElementById('tabAttendanceBtn');
  const historyBtn = document.getElementById('tabHistoryBtn');
  const approvalsBtn = document.getElementById('tabAdminApprovalsBtn');
  const rankingsBtn = document.getElementById('tabAdminRankingsBtn');
  const consoleBtn = document.getElementById('tabAdminConsoleBtn');

  const isAdmin = STATE.currentUser && STATE.currentUser.role === 'admin';

  if (isAdmin) {
    // Hide member check-in tabs for admin (admin attendance is not needed)
    if (attendanceBtn) attendanceBtn.classList.add('hidden');
    if (historyBtn) historyBtn.classList.add('hidden');

    // Show admin dedicated navigation tabs
    if (approvalsBtn) approvalsBtn.classList.remove('hidden');
    if (rankingsBtn) rankingsBtn.classList.remove('hidden');
    if (consoleBtn) consoleBtn.classList.remove('hidden');

    // Update pending badge on approvals tab
    const pendingCount = STATE.adminPendingUsers ? STATE.adminPendingUsers.length : 0;
    const navBadge = document.getElementById('navPendingBadge');
    if (navBadge) {
      navBadge.textContent = pendingCount;
      navBadge.classList.toggle('hidden', pendingCount === 0);
    }

    const currentTab = STATE.adminActiveTab || 'pending';
    [approvalsBtn, rankingsBtn, consoleBtn].forEach(b => {
      if (b) b.className = "tap-scale flex-1 flex flex-col items-center justify-center py-1 text-white/50 hover:text-white transition";
    });

    if (currentTab === 'pending' && approvalsBtn) {
      approvalsBtn.className = "tap-scale flex-1 flex flex-col items-center justify-center py-1 text-[#2F7FF5] transition";
    } else if (currentTab === 'rank' && rankingsBtn) {
      rankingsBtn.className = "tap-scale flex-1 flex flex-col items-center justify-center py-1 text-[#2F7FF5] transition";
    } else if (consoleBtn) {
      consoleBtn.className = "tap-scale flex-1 flex flex-col items-center justify-center py-1 text-[#2F7FF5] transition";
    }
  } else {
    // Regular member navigation
    if (attendanceBtn) attendanceBtn.classList.remove('hidden');
    if (historyBtn) historyBtn.classList.remove('hidden');
    if (approvalsBtn) approvalsBtn.classList.add('hidden');
    if (rankingsBtn) rankingsBtn.classList.add('hidden');
    if (consoleBtn) consoleBtn.classList.add('hidden');

    if (attendanceBtn) {
      attendanceBtn.className = activeTab === 'attendance'
        ? "tap-scale flex-1 flex flex-col items-center justify-center py-1 text-[#2F7FF5] transition"
        : "tap-scale flex-1 flex flex-col items-center justify-center py-1 text-white/50 hover:text-white transition";
    }
    if (historyBtn) {
      historyBtn.className = activeTab === 'history'
        ? "tap-scale flex-1 flex flex-col items-center justify-center py-1 text-[#2F7FF5] transition"
        : "tap-scale flex-1 flex flex-col items-center justify-center py-1 text-white/50 hover:text-white transition";
    }
  }
}

function switchNavTab(tab) {
  if (tab === 'attendance') {
    if (STATE.currentUser && STATE.currentUser.role === 'admin') {
      switchAdminTab('pending');
      return;
    }
    showScreen('attendance');
  } else if (tab === 'history') {
    if (STATE.currentUser && STATE.currentUser.role === 'admin') {
      switchAdminTab('rank');
      return;
    }
    renderHistory();
    showScreen('history');
  } else if (tab === 'admin') {
    if (STATE.currentUser && STATE.currentUser.role === 'admin') {
      loadAdminData();
      showScreen('admin');
    }
  }
}

function switchAdminTab(tab) {
  showScreen('admin');
  setAdminTab(tab);
}

// ------------------------------------------------------------------------------
// 4. AUTHENTICATION & SESSION MANAGEMENT
// ------------------------------------------------------------------------------
async function checkAuthSession() {
  if (!initSupabase()) {
    showScreen('login');
    return;
  }

  // Fast-Boot Cache: pre-populate user profile for instantaneous mobile app launch
  const cached = localStorage.getItem('MANAVAR_CACHED_USER');
  if (cached) {
    try {
      const profile = JSON.parse(cached);
      if (profile && profile.id) {
        STATE.currentUser = profile;
        STATE.isAuthenticated = true;
        const greetingElem = document.getElementById('studentGreeting');
        if (greetingElem) {
          const timeHour = new Date().getHours();
          const period = timeHour < 12 ? 'morning' : timeHour < 17 ? 'afternoon' : 'evening';
          greetingElem.textContent = `Good ${period}, ${profile.name.split(' ')[0]}`;
        }
      }
    } catch (e) {}
  }

  try {
    const { data: { session }, error } = await STATE.supabase.auth.getSession();
    if (error || !session) {
      STATE.isAuthenticated = false;
      STATE.currentUser = null;
      localStorage.removeItem('MANAVAR_CACHED_USER');
      showScreen('login');
      return;
    }

    await loadUserProfile(session.user.id);
  } catch (err) {
    console.error('Session check failed:', err);
    if (!STATE.isAuthenticated) {
      showScreen('login');
    }
  }
}

async function loadUserProfile(userId) {
  try {
    const { data: profile, error } = await STATE.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error || !profile) {
      console.warn('Profile not found, logging out.');
      await STATE.supabase.auth.signOut();
      localStorage.removeItem('MANAVAR_CACHED_USER');
      showScreen('login');
      return;
    }

    STATE.currentUser = profile;
    STATE.isAuthenticated = true;
    localStorage.setItem('MANAVAR_CACHED_USER', JSON.stringify(profile));

    // Update greeting
    const greetingElem = document.getElementById('studentGreeting');
    if (greetingElem) {
      const timeHour = new Date().getHours();
      const period = timeHour < 12 ? 'morning' : timeHour < 17 ? 'afternoon' : 'evening';
      greetingElem.textContent = `Good ${period}, ${profile.name.split(' ')[0]}`;
    }

    // Update student ticket chip on approval screen
    const ticketName = document.getElementById('ticketStudentName');
    const ticketIdent = document.getElementById('ticketStudentIdent');
    if (ticketName) ticketName.textContent = profile.name || 'Member';
    if (ticketIdent) {
      const rollTag = profile.roll_no ? `${profile.roll_no} • ` : '';
      const deptTag = profile.department ? `${profile.department}` : (profile.identifier || 'Pending Verification');
      ticketIdent.textContent = `${rollTag}${deptTag}`;
    }

    // Role and approval status routing
    if (profile.approval_status === 'pending') {
      showScreen('approval');
      return;
    }

    if (profile.approval_status === 'rejected') {
      showToast("Account not approved. Contact club admin.");
      await STATE.supabase.auth.signOut();
      localStorage.removeItem('MANAVAR_CACHED_USER');
      showScreen('login');
      return;
    }

    // Admin routing (no attendance check-in needed for admin)
    if (profile.role === 'admin') {
      showScreen('admin');
      await loadAdminData();
      return;
    }

    // Member is approved!
    await loadTodayAttendance();
    await loadAttendanceHistory();
    showScreen('attendance');
  } catch (err) {
    console.error('Error loading profile:', err);
    showToast("Failed to load user profile");
    showScreen('login');
  }
}

async function handleLogin() {
  if (!STATE.isConfigured && !initSupabase()) {
    showToast("Connecting to service...");
    return;
  }

  const identityInput = document.getElementById('loginIdentity').value.trim();
  const password = document.getElementById('loginPassword').value;
  const loginBtn = document.querySelector('#loginForm button[type="submit"]');

  if (!identityInput || !password) {
    showToast("Please enter email/roll no and password");
    return;
  }

  if (loginBtn) {
    loginBtn.disabled = true;
    loginBtn.innerHTML = `
      <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
      </svg>
      <span>Signing In...</span>
    `;
  }

  try {
    let authEmailToUse = null;
    if (identityInput.includes('@')) {
      authEmailToUse = identityInput.toLowerCase();
    } else {
      // Check RPC to resolve roll number or phone to registered auth email
      try {
        const { data: resolvedEmail, error: rpcErr } = await STATE.supabase.rpc('get_login_email', {
          p_identifier: identityInput
        });
        if (!rpcErr && resolvedEmail) {
          authEmailToUse = resolvedEmail;
        }
      } catch (e) {
        console.warn("RPC get_login_email fallback:", e);
      }

      if (!authEmailToUse) {
        const normalized = normalizeAuthIdentifier(identityInput);
        authEmailToUse = normalized.authEmail;
      }
    }

    const { data, error } = await STATE.supabase.auth.signInWithPassword({
      email: authEmailToUse,
      password: password
    });

    if (error) {
      showToast(error.message || "Invalid login credentials");
      return;
    }

    if (data && data.user) {
      playChime(true);
      showToast("Login successful!");
      await loadUserProfile(data.user.id);
    }
  } catch (err) {
    console.error("Login error:", err);
    showToast(err.message || "Login failed");
  } finally {
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.innerHTML = `
        <span>Sign In</span>
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/>
        </svg>
      `;
    }
  }
}

function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (btn) {
      btn.innerHTML = `<svg class="w-4 h-4 text-[#529BF8]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/></svg>`;
    }
  } else {
    input.type = 'password';
    if (btn) {
      btn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`;
    }
  }
}

function checkPasswordMatch() {
  const p1Elem = document.getElementById('signupPassword');
  const p2Elem = document.getElementById('signupConfirm');
  const statusBox = document.getElementById('passwordMatchStatus');
  const statusIcon = document.getElementById('passwordMatchIcon');
  const statusText = document.getElementById('passwordMatchText');
  if (!p1Elem || !p2Elem || !statusBox || !statusIcon || !statusText) return;

  const p1 = p1Elem.value;
  const p2 = p2Elem.value;

  if (!p1 && !p2) {
    statusBox.classList.add('hidden');
    p1Elem.classList.remove('border-emerald-500', 'border-rose-500', 'border-amber-500');
    p2Elem.classList.remove('border-emerald-500', 'border-rose-500');
    return;
  }

  statusBox.classList.remove('hidden');

  if (p1.length > 0 && p1.length < 6) {
    statusBox.className = "px-2.5 py-1 rounded-xl text-[11px] font-medium flex items-center space-x-1.5 bg-amber-500/10 text-amber-300 border border-amber-500/25";
    statusIcon.innerHTML = `<svg class="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>`;
    statusText.textContent = `Password needs at least 6 characters (${p1.length}/6)`;
    p1Elem.classList.add('border-amber-500');
    p1Elem.classList.remove('border-emerald-500');
    return;
  } else if (p1.length >= 6) {
    p1Elem.classList.remove('border-amber-500');
  }

  if (p2.length > 0) {
    if (p1 === p2) {
      statusBox.className = "px-2.5 py-1 rounded-xl text-[11px] font-medium flex items-center space-x-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25";
      statusIcon.innerHTML = `<svg class="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>`;
      statusText.textContent = "✓ Passwords match";
      p2Elem.classList.remove('border-rose-500');
      p2Elem.classList.add('border-emerald-500');
    } else {
      statusBox.className = "px-2.5 py-1 rounded-xl text-[11px] font-medium flex items-center space-x-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/25";
      statusIcon.innerHTML = `<svg class="w-3.5 h-3.5 text-rose-400" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>`;
      statusText.textContent = "Passwords do not match";
      p2Elem.classList.remove('border-emerald-500');
      p2Elem.classList.add('border-rose-500');
    }
  } else {
    statusBox.className = "px-2.5 py-1 rounded-xl text-[11px] font-medium flex items-center space-x-1.5 bg-white/[0.05] text-white/60 border border-white/10";
    statusIcon.innerHTML = `<svg class="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
    statusText.textContent = "Re-enter password in Confirm to verify";
    p2Elem.classList.remove('border-emerald-500', 'border-rose-500');
  }
}

async function handleSignup() {
  if (!STATE.isConfigured && !initSupabase()) {
    showToast("Connecting to service, please try again...");
    return;
  }

  const name = document.getElementById('signupName').value.trim();
  const rollNo = (document.getElementById('signupRoll')?.value || '').trim().toUpperCase();
  const department = (document.getElementById('signupDept')?.value || '').trim();
  const batchYear = (document.getElementById('signupYear')?.value || '').trim();
  const identityInput = document.getElementById('signupIdentity').value.trim();
  const password = document.getElementById('signupPassword').value;
  const confirmPassword = document.getElementById('signupConfirm').value;
  const signupBtn = document.querySelector('#signupForm button[type="submit"]');

  if (!name || !rollNo || !identityInput || !password) {
    showToast("Please fill in all required fields");
    return;
  }

  if (password.length < 6) {
    showToast("Password must be at least 6 characters");
    const p1 = document.getElementById('signupPassword');
    if (p1) {
      p1.focus();
      p1.classList.add('border-amber-500');
    }
    checkPasswordMatch();
    return;
  }

  if (password !== confirmPassword) {
    showToast("Passwords do not match. Please verify.");
    const p2 = document.getElementById('signupConfirm');
    if (p2) {
      p2.focus();
      p2.classList.add('border-rose-500');
    }
    checkPasswordMatch();
    return;
  }

  if (signupBtn) {
    signupBtn.disabled = true;
    signupBtn.textContent = "Verifying Roll No...";
  }

  // Pre-check: Enforce one-time registration per roll number
  const uniquenessCheck = await checkRollUniquenessRemote(rollNo);
  if (uniquenessCheck.registered) {
    if (signupBtn) {
      signupBtn.disabled = false;
      signupBtn.textContent = "Register Account";
    }
    showToast("⚠️ Roll number " + rollNo + " is already registered!");
    openDuplicateRollModal(rollNo);
    const dupNotice = document.getElementById('duplicateRollInlineNotice');
    if (dupNotice) dupNotice.classList.remove('hidden');
    const dupInlineRollText = document.getElementById('dupInlineRollText');
    if (dupInlineRollText) dupInlineRollText.textContent = rollNo;
    const rInput = document.getElementById('signupRoll');
    if (rInput) {
      rInput.focus();
      rInput.classList.add('border-amber-500');
    }
    return;
  }

  if (signupBtn) {
    signupBtn.textContent = "Creating Account...";
  }

  try {
    const normalized = normalizeAuthIdentifier(identityInput, rollNo);
    const { data, error } = await STATE.supabase.auth.signUp({
      email: normalized.authEmail,
      password: password,
      options: {
        data: {
          name: name,
          identifier: normalized.displayIdentifier,
          roll_no: rollNo,
          department: department,
          batch_year: batchYear
        }
      }
    });

    if (error) {
      const errMsg = (error.message || '').toLowerCase();
      if (errMsg.includes('already registered') || errMsg.includes('unique') || errMsg.includes('duplicate')) {
        showToast("⚠️ This roll number is already registered!");
        openDuplicateRollModal(rollNo);
      } else {
        showToast(error.message);
      }
      return;
    }

    if (data && data.user) {
      playChime(true);
      showToast("Account created successfully!");
      // Check if session was returned or needs email confirm
      if (data.session) {
        await loadUserProfile(data.user.id);
      } else {
        // If email confirmation is disabled in Supabase, sign in automatically
        const { data: signInData, error: signInErr } = await STATE.supabase.auth.signInWithPassword({
          email: normalized.authEmail,
          password: password
        });
        if (signInData && signInData.user) {
          await loadUserProfile(signInData.user.id);
        } else {
          showScreen('approval');
        }
      }
    }
  } catch (err) {
    console.error("Signup error:", err);
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('already registered') || msg.includes('unique') || msg.includes('duplicate')) {
      showToast("⚠️ This roll number is already registered!");
      openDuplicateRollModal(rollNo);
    } else {
      showToast(err.message || "Failed to create account");
    }
  } finally {
    if (signupBtn) {
      signupBtn.disabled = false;
      signupBtn.textContent = "Register Account";
    }
  }
}

async function checkApprovalStatus() {
  if (!STATE.currentUser || !STATE.supabase) return;
  const btnText = document.getElementById('btnStatusText');
  const icon = document.getElementById('refreshIcon');
  if (btnText) btnText.textContent = "Checking queue...";
  if (icon) icon.classList.add('animate-spin');

  try {
    const { data: profile, error } = await STATE.supabase
      .from('profiles')
      .select('*')
      .eq('id', STATE.currentUser.id)
      .single();

    if (profile) {
      STATE.currentUser = profile;
      if (profile.approval_status === 'approved') {
        playChime(true);
        triggerConfetti();
        showToast("✓ Account approved! Welcome.");
        await loadTodayAttendance();
        await loadAttendanceHistory();
        showScreen('attendance');
        return;
      } else {
        showToast("Queue updated: Still pending club admin review");
      }
    }
  } catch (err) {
    showToast("Error checking queue status");
  } finally {
    if (btnText) btnText.textContent = "Check Approval Status";
    if (icon) icon.classList.remove('animate-spin');
  }
}

function openSupportSheet() {
  const sheet = document.getElementById('supportSheet');
  if (sheet) sheet.classList.remove('hidden');
}

function closeSupportSheet() {
  const sheet = document.getElementById('supportSheet');
  if (sheet) sheet.classList.add('hidden');
}

function copyTicketReference() {
  const textEl = document.getElementById('copyTicketText');
  const ticketId = STATE.currentUser ? `#ATT-${STATE.currentUser.id.substring(0, 6).toUpperCase()}` : '#ATT-PENDING';
  navigator.clipboard?.writeText(ticketId).catch(() => {});
  if (textEl) textEl.textContent = `Copied ${ticketId}!`;
  showToast(`Copied ${ticketId} to clipboard`);
  setTimeout(() => {
    if (textEl) textEl.textContent = "Copy Registration Ticket ID";
  }, 2200);
}

async function handleLogout() {
  if (STATE.supabase) {
    await STATE.supabase.auth.signOut();
  }
  STATE.isAuthenticated = false;
  STATE.currentUser = null;
  STATE.todayMarked = false;
  STATE.historyRecords = [];
  showToast("Logged out");
  showScreen('login');
}

// ------------------------------------------------------------------------------
// 5. ATTENDANCE OPERATIONS (MARK, DELETE, STATS)
// ------------------------------------------------------------------------------
async function loadTodayAttendance() {
  if (!STATE.currentUser || !STATE.supabase) return;
  const todayStr = getTodayDateString();

  try {
    const { data, error } = await STATE.supabase
      .from('attendance')
      .select('*')
      .eq('user_id', STATE.currentUser.id)
      .eq('attendance_date', todayStr)
      .maybeSingle();

    if (error) {
      console.error('Error fetching today attendance:', error);
      return;
    }

    if (data) {
      STATE.todayMarked = true;
      STATE.todayAttendanceId = data.id;
      STATE.todayMarkedTime = formatTimeString(data.created_at);
      const stampElem = document.getElementById('markedTimestamp');
      if (stampElem) stampElem.textContent = `Logged today at ${STATE.todayMarkedTime}`;
    } else {
      STATE.todayMarked = false;
      STATE.todayAttendanceId = null;
      STATE.todayMarkedTime = '';
    }

    syncAttendanceButtonState();
  } catch (err) {
    console.error('Failed to load today record:', err);
  }
}

async function markTodayAttendance() {
  if (!STATE.currentUser || !STATE.supabase) return;

  if (STATE.currentUser.approval_status !== 'approved') {
    showToast("Your account is pending club admin approval");
    return;
  }

  const todayStr = getTodayDateString();
  const markBtn = document.getElementById('markAttendanceBtn');
  if (markBtn) markBtn.disabled = true;

  try {
    const { data, error } = await STATE.supabase
      .from('attendance')
      .insert({
        user_id: STATE.currentUser.id,
        attendance_date: todayStr,
        status: 'PRESENT'
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505' || error.message.includes('unique')) {
        showToast("Attendance already marked for today");
      } else {
        showToast(error.message || "Failed to record attendance");
      }
      return;
    }

    playChime(true);
    triggerConfetti();

    STATE.todayMarked = true;
    STATE.todayAttendanceId = data.id;
    STATE.todayMarkedTime = formatTimeString(data.created_at);
    
    const stampElem = document.getElementById('markedTimestamp');
    if (stampElem) stampElem.textContent = `Logged today at ${STATE.todayMarkedTime}`;

    syncAttendanceButtonState();
    await loadAttendanceHistory();
    showToast("✓ Attendance recorded");
  } catch (err) {
    console.error('Mark attendance failed:', err);
    showToast("Failed to mark attendance");
  } finally {
    if (markBtn) markBtn.disabled = false;
  }
}

function openDeleteConfirmation() {
  const modal = document.getElementById('deleteModal');
  if (modal) modal.classList.remove('hidden');
}

function closeDeleteConfirmation() {
  const modal = document.getElementById('deleteModal');
  if (modal) modal.classList.add('hidden');
}

async function confirmDeleteTodayAttendance() {
  if (!STATE.currentUser || !STATE.supabase) return;
  closeDeleteConfirmation();

  const todayStr = getTodayDateString();

  try {
    const { error } = await STATE.supabase
      .from('attendance')
      .delete()
      .eq('user_id', STATE.currentUser.id)
      .eq('attendance_date', todayStr);

    if (error) {
      showToast(error.message || "Failed to delete today's record");
      return;
    }

    playChime(false);
    STATE.todayMarked = false;
    STATE.todayAttendanceId = null;
    STATE.todayMarkedTime = '';

    syncAttendanceButtonState();
    await loadAttendanceHistory();
    showToast("Today's record deleted");
  } catch (err) {
    console.error("Delete failed:", err);
    showToast("Error deleting attendance");
  }
}

function syncAttendanceButtonState() {
  const unmarkedView = document.getElementById('unmarkedState');
  const markedView = document.getElementById('markedState');
  const companion = document.getElementById('attendanceGhostCompanion');

  if (STATE.todayMarked) {
    if (unmarkedView) unmarkedView.classList.add('hidden');
    if (markedView) markedView.classList.remove('hidden');
    if (companion) {
      companion.classList.remove('ghost-float');
      companion.classList.add('ghost-celebrate');
    }
  } else {
    if (markedView) markedView.classList.add('hidden');
    if (unmarkedView) unmarkedView.classList.remove('hidden');
    if (companion) {
      companion.classList.remove('ghost-celebrate');
      companion.classList.add('ghost-float');
    }
  }
  updateDynamicIsland();
  renderWeekStrip();
}

function pokeCompanionGhost() {
  const companion = document.getElementById('attendanceGhostCompanion');
  if (companion) {
    companion.classList.remove('ghost-float');
    companion.classList.add('ghost-celebrate');
    setTimeout(() => {
      if (!STATE.todayMarked) {
        companion.classList.remove('ghost-celebrate');
        companion.classList.add('ghost-float');
      }
    }, 2800);
  }
  const quotes = [
    "Manavar Illam mascot is rooting for you! ✨",
    "Keep up your great attendance streak! 💙",
    "One tap each day builds great habits! 🚀",
    "Proud of your dedication to Manavar Illam! 🌟"
  ];
  const msg = quotes[Math.floor(Math.random() * quotes.length)];
  showToast(msg);
}

function renderWeekStrip() {
  const row = document.getElementById('weekDaysRow');
  if (!row) return;
  row.innerHTML = '';

  const now = new Date();
  const currentDayOfWeek = (now.getDay() + 6) % 7; // 0=Monday, 6=Sunday
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  // Identify dates of current week (Monday to Sunday)
  const monday = new Date(now);
  monday.setDate(now.getDate() - currentDayOfWeek);

  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekDates.push(getTodayDateString(d));
  }

  // Set of dates user was present
  const presentDates = new Set(
    STATE.historyRecords
      .filter(r => r.status.toLowerCase() === 'present')
      .map(r => r.date)
  );

  labels.forEach((lbl, idx) => {
    const dateStr = weekDates[idx];
    const isToday = idx === currentDayOfWeek;
    const isPresent = isToday ? STATE.todayMarked : presentDates.has(dateStr);
    const isPast = idx < currentDayOfWeek;

    const pill = document.createElement('div');
    let bgStyle = 'bg-white/[0.04] text-white/50 border border-white/[0.05]';
    let ringStyle = isToday ? 'ring-1 ring-[#2F7FF5] text-white font-bold' : '';

    if (isPresent) {
      bgStyle = 'btn-gradient-primary text-white font-bold shadow-[0_0_8px_rgba(47,127,245,0.4)]';
    } else if (isToday) {
      bgStyle = 'bg-[#2F7FF5]/15 text-[#529BF8] font-bold border border-[#2F7FF5]/30';
    } else if (idx >= 5) {
      bgStyle = 'bg-white/[0.02] text-white/30 border border-white/[0.03]';
    }

    pill.className = `w-7 h-8 rounded-xl flex flex-col items-center justify-center text-[10px] ${bgStyle} ${ringStyle} transition-all duration-200`;
    pill.innerHTML = `
      <span>${lbl}</span>
      <span class="text-[8px] mt-0.5 leading-none">${isPresent ? '●' : '○'}</span>
    `;
    row.appendChild(pill);
  });
}

// ------------------------------------------------------------------------------
// 6. ATTENDANCE HISTORY & PERCENTAGE STATS
// ------------------------------------------------------------------------------
async function loadAttendanceHistory() {
  if (!STATE.currentUser || !STATE.supabase) return;

  try {
    const { data, error } = await STATE.supabase
      .from('attendance')
      .select('*')
      .eq('user_id', STATE.currentUser.id)
      .order('attendance_date', { ascending: false });

    if (error) {
      console.error('History load error:', error);
      return;
    }

    STATE.historyRecords = (data || []).map(row => ({
      id: row.id,
      date: row.attendance_date,
      label: formatDateLabel(row.attendance_date),
      status: (row.status || 'present').toLowerCase(),
      time: formatTimeString(row.created_at),
      month: formatMonthHeader(row.attendance_date)
    }));

    recalculateStats();
    if (STATE.currentScreen === 'history') {
      renderHistory();
    }
    renderWeekStrip();
  } catch (err) {
    console.error('Load history failed:', err);
  }
}

function recalculateStats() {
  const loggedDays = STATE.historyRecords.filter(r => r.status === 'present' || r.status === 'absent');
  const totalDays = loggedDays.length;
  const presentDays = loggedDays.filter(r => r.status === 'present').length;

  let pct = 0;
  if (totalDays > 0) {
    pct = ((presentDays / totalDays) * 100).toFixed(1);
  }

  const pctElem = document.getElementById('percentageDisplay');
  const ratioElem = document.getElementById('ratioDisplay');
  const circleNum = document.getElementById('progressCircleNumber');
  const svgCircle = document.getElementById('svgProgressCircle');

  if (pctElem) pctElem.textContent = `${pct}%`;
  if (ratioElem) ratioElem.textContent = `${presentDays} / ${totalDays} days`;
  if (circleNum) circleNum.textContent = `${Math.round(pct)}%`;

  if (svgCircle) {
    const offset = Math.max(0, 100 - parseFloat(pct));
    svgCircle.style.strokeDashoffset = offset;
  }

  const filterAll = document.getElementById('filterAllCount');
  const filterPres = document.getElementById('filterPresentCount');
  const filterAbs = document.getElementById('filterAbsentCount');

  if (filterAll) filterAll.textContent = totalDays;
  if (filterPres) filterPres.textContent = presentDays;
  if (filterAbs) filterAbs.textContent = totalDays - presentDays;
}

function setHistoryFilter(filter) {
  STATE.activeHistoryFilter = filter;
  const allBtn = document.getElementById('filterAllBtn');
  const presBtn = document.getElementById('filterPresentBtn');
  const absBtn = document.getElementById('filterAbsentBtn');

  [allBtn, presBtn, absBtn].forEach(b => {
    if (b) b.className = "tap-scale flex-1 py-2 rounded-xl text-white/60 hover:text-white text-center transition";
  });

  const activeBtn = filter === 'all' ? allBtn : filter === 'present' ? presBtn : absBtn;
  if (activeBtn) {
    activeBtn.className = "tap-scale flex-1 py-2 rounded-xl bg-gradient-to-r from-[#2F7FF5] to-[#4FA1FF] text-white text-center font-bold shadow-md transition";
  }

  renderHistory();
}

function renderHistory() {
  const container = document.getElementById('historyListContainer');
  if (!container) return;
  container.innerHTML = '';

  const groups = {};
  STATE.historyRecords.forEach(item => {
    if (STATE.activeHistoryFilter !== 'all' && item.status !== STATE.activeHistoryFilter) return;

    if (!groups[item.month]) {
      groups[item.month] = [];
    }
    groups[item.month].push(item);
  });

  const months = Object.keys(groups);
  if (months.length === 0) {
    container.innerHTML = `
      <div class="py-12 flex flex-col items-center justify-center text-center px-4">
        <div class="w-20 h-20 relative mb-3 ghost-float">
          <svg class="w-20 h-20 drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]" viewBox="0 0 120 120" fill="none">
            <path d="M60 20C41 20 28 35 28 54C28 72 25 89 33 93C39 96 44 89 50 91C56 93 57 97 63 97C69 97 71 92 77 92C83 92 86 96 92 92C97 88 92 70 92 54C92 35 79 20 60 20Z" fill="url(#ghostBodyGrad)"></path>
            <path d="M38 34C44 26 53 22 62 22C71 22 79 25 84 31" stroke="url(#sheenEdge)" stroke-linecap="round" stroke-width="2.5"></path>
            <ellipse cx="50" cy="50" fill="#061224" rx="3.5" ry="4.5"></ellipse>
            <ellipse cx="70" cy="50" fill="#061224" rx="3.5" ry="4.5"></ellipse>
            <circle cx="51.5" cy="48.5" fill="#FFFFFF" r="1.4"></circle>
            <circle cx="71.5" cy="48.5" fill="#FFFFFF" r="1.4"></circle>
            <circle cx="43" cy="57" fill="#60A5FA" fill-opacity="0.45" r="3.2"></circle>
            <circle cx="77" cy="57" fill="#60A5FA" fill-opacity="0.45" r="3.2"></circle>
            <path d="M57 58C58.8 60 61.2 60 63 58" stroke="#0B2042" stroke-linecap="round" stroke-width="1.8"></path>
          </svg>
        </div>
        <p class="text-sm font-bold text-white">No records found</p>
        <p class="text-xs text-white/50 mt-1 max-w-[240px]">Mark today's attendance to start your verified check-in history!</p>
      </div>
    `;
    return;
  }

  months.forEach(month => {
    const monthPresentCount = groups[month].filter(i => i.status === 'present').length;
    const monthTotal = groups[month].length;
    const monthPct = monthTotal > 0 ? Math.round((monthPresentCount / monthTotal) * 100) : 0;

    const monthHeader = document.createElement('div');
    monthHeader.className = "sticky top-0 bg-[#06080D]/85 backdrop-blur-md py-1.5 z-10 flex items-center justify-between border-b border-white/[0.05]";
    monthHeader.innerHTML = `
      <h3 class="text-[11px] font-bold text-white/50 uppercase tracking-wider">${month}</h3>
      <span class="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-white/[0.08] text-white/80 border border-white/10">
        ${monthPresentCount}/${monthTotal} (${monthPct}%)
      </span>
    `;
    container.appendChild(monthHeader);

    const listGroup = document.createElement('div');
    listGroup.className = "space-y-2 mt-2 mb-4";

    groups[month].forEach(item => {
      const isPresent = item.status === 'present';
      const row = document.createElement('div');
      row.className = `flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-200 ${
        isPresent ? 'zentra-card-elevated text-white' : 'zentra-card text-white/60'
      }`;

      row.innerHTML = `
        <div class="flex items-center space-x-3">
          <span class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden ${
            isPresent ? 'btn-gradient-primary text-white shadow-sm' : 'bg-white/10 text-white/50'
          }">
            ${isPresent ? '✓' : '✕'}
          </span>
          <div>
            <span class="text-sm font-bold tracking-tight text-white block">${item.label}</span>
            <span class="text-[11px] text-white/50 font-medium">${item.time !== '--' ? item.time : 'No record'}</span>
          </div>
        </div>
        <span class="text-xs font-bold px-3 py-1 rounded-full ${
          isPresent 
            ? 'text-[#529BF8] bg-[#2F7FF5]/15 border border-[#2F7FF5]/30' 
            : 'text-white/40 bg-white/[0.05] border border-white/[0.05]'
        }">
          ${isPresent ? 'Present' : 'Absent'}
        </span>
      `;
      listGroup.appendChild(row);
    });

    container.appendChild(listGroup);
  });
}

// ------------------------------------------------------------------------------
// 7. ADMIN AREA: USER MANAGEMENT, APPROVAL, DELETE & CSV EXPORT
// ------------------------------------------------------------------------------
async function loadAdminData() {
  if (!STATE.currentUser || STATE.currentUser.role !== 'admin' || !STATE.supabase) return;

  try {
    // 1. Fetch all profiles
    const { data: users, error: userErr } = await STATE.supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (userErr) throw userErr;

    STATE.adminUsers = users || [];
    STATE.adminPendingUsers = STATE.adminUsers.filter(u => u.approval_status === 'pending');

    // 2. Fetch all attendance records (with member profiles)
    const { data: records, error: attErr } = await STATE.supabase
      .from('attendance')
      .select('*, profiles(name, identifier, roll_no, department, batch_year)')
      .order('attendance_date', { ascending: false });

    if (attErr) throw attErr;

    STATE.adminAttendance = records || [];

    renderAdminUI();
  } catch (err) {
    console.error('Failed to load admin data:', err);
    showToast("Error loading admin data: " + err.message);
  }
}

function renderAdminUI() {
  // Update header capacity counter (total registered members)
  const capacityElem = document.getElementById('adminCapacityCount');
  const count = STATE.adminUsers.length;
  if (capacityElem) capacityElem.textContent = count;

  // Update tab counters
  const tabAllCount = document.getElementById('adminTabAllCount');
  const tabPendingCount = document.getElementById('adminTabPendingCount');
  const tabAttCount = document.getElementById('adminTabAttCount');

  if (tabAllCount) tabAllCount.textContent = STATE.adminUsers.length;
  if (tabPendingCount) tabPendingCount.textContent = STATE.adminPendingUsers.length;
  if (tabAttCount) tabAttCount.textContent = STATE.adminAttendance.length;

  // Update bottom nav pending counter badge
  const navBadge = document.getElementById('navPendingBadge');
  if (navBadge) {
    const pCount = STATE.adminPendingUsers.length;
    navBadge.textContent = pCount;
    navBadge.classList.toggle('hidden', pCount === 0);
  }

  const container = document.getElementById('adminContentContainer');
  if (!container) return;
  container.innerHTML = '';

  // -------------------------------------------------------------
  // VIEW 1: APPROVAL DASHBOARD ('pending')
  // -------------------------------------------------------------
  if (STATE.adminActiveTab === 'pending') {
    const pendingList = STATE.adminPendingUsers || [];

    if (pendingList.length === 0) {
      container.innerHTML = `
        <div class="py-12 flex flex-col items-center justify-center text-center px-4">
          <div class="w-24 h-24 relative mb-3 ghost-float">
            <svg class="w-24 h-24 drop-shadow-[0_12px_24px_rgba(0,0,0,0.6)]" viewBox="0 0 120 120" fill="none">
              <path d="M60 20C41 20 28 35 28 54C28 72 25 89 33 93C39 96 44 89 50 91C56 93 57 97 63 97C69 97 71 92 77 92C83 92 86 96 92 92C97 88 92 70 92 54C92 35 79 20 60 20Z" fill="url(#ghostBodyGrad)"></path>
              <path d="M38 34C44 26 53 22 62 22C71 22 79 25 84 31" stroke="url(#sheenEdge)" stroke-linecap="round" stroke-width="2.5"></path>
              <ellipse cx="50" cy="50" fill="#040A18" rx="3.5" ry="4.5"></ellipse>
              <ellipse cx="70" cy="50" fill="#040A18" rx="3.5" ry="4.5"></ellipse>
              <circle cx="51.5" cy="48.5" fill="#FFFFFF" r="1.4"></circle>
              <circle cx="71.5" cy="48.5" fill="#FFFFFF" r="1.4"></circle>
              <circle cx="43" cy="57" fill="#60A5FA" fill-opacity="0.5" r="3.2"></circle>
              <circle cx="77" cy="57" fill="#60A5FA" fill-opacity="0.5" r="3.2"></circle>
              <path d="M57 58C58.8 60 61.2 60 63 58" stroke="#0B2042" stroke-linecap="round" stroke-width="1.8"></path>
            </svg>
          </div>
          <p class="text-base font-bold text-white">Queue Clear!</p>
          <p class="text-xs text-white/50 mt-1 max-w-[260px]">All registered members are approved and ready for club attendance.</p>
        </div>
      `;
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'space-y-3';

    // Top action bar
    const queueHeader = document.createElement('div');
    queueHeader.className = 'flex items-center justify-between px-1 py-0.5';
    queueHeader.innerHTML = `
      <span class="text-xs font-semibold text-white/70">
        <span class="text-amber-300 font-bold">${pendingList.length}</span> Awaiting Review
      </span>
      ${pendingList.length > 1 ? `
        <button onclick="adminApproveAllUsers()" class="tap-scale px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold hover:bg-emerald-500/30 transition shadow-sm">
          ✓ Approve All (${pendingList.length})
        </button>
      ` : ''}
    `;
    wrapper.appendChild(queueHeader);

    // Cards list
    pendingList.forEach(user => {
      const card = document.createElement('div');
      card.className = 'zentra-card-elevated p-4 rounded-2xl border border-amber-400/25 shadow-lg space-y-3 relative overflow-hidden';
      card.innerHTML = `
        <div class="flex items-start justify-between">
          <div class="flex items-start space-x-3 truncate">
            <div class="w-10 h-10 rounded-2xl bg-amber-400/15 text-amber-300 border border-amber-400/30 flex items-center justify-center font-bold text-sm flex-shrink-0 mt-0.5">
              ${(user.name || 'M')[0].toUpperCase()}
            </div>
            <div class="truncate">
              <div class="flex items-center space-x-1.5 flex-wrap">
                <span class="text-sm font-bold text-white truncate">${user.name}</span>
                ${user.roll_no ? `<span class="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-blue-500/25 text-blue-300 border border-blue-500/30">${user.roll_no}</span>` : ''}
              </div>
              <p class="text-[11px] text-white/60 truncate mt-0.5">
                ${user.department ? `${user.department} • ` : ''}${user.batch_year ? `${user.batch_year} Batch` : ''}
              </p>
              <p class="text-[10px] text-white/40 truncate mt-0.5 font-mono">
                ${user.identifier}
              </p>
            </div>
          </div>
          <span class="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/30 flex-shrink-0">
            Pending
          </span>
        </div>

        <div class="flex items-center justify-end space-x-2.5 pt-2 border-t border-white/[0.06]">
          <button onclick="openAdminDeleteModal('${user.id}', '${encodeURIComponent(user.name)}')" class="tap-scale px-3.5 py-1.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/25 text-xs font-semibold hover:bg-red-500/20 transition">
            ✕ Reject
          </button>
          <button onclick="adminApproveUser('${user.id}')" class="tap-scale px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold shadow-md hover:brightness-110 transition">
            ✓ Approve
          </button>
        </div>
      `;
      wrapper.appendChild(card);
    });

    container.appendChild(wrapper);
    return;
  }

  // -------------------------------------------------------------
  // VIEW 2: ATTENDANCE LEADERBOARD / RANKING ('rank')
  // -------------------------------------------------------------
  if (STATE.adminActiveTab === 'rank') {
    const members = STATE.adminUsers.filter(u => u.role !== 'admin');
    const uniqueDates = [...new Set(STATE.adminAttendance.map(a => a.attendance_date))];
    const totalSessions = Math.max(uniqueDates.length, 1);

    // Compute stats for each member
    const rankedList = members.map(m => {
      const records = STATE.adminAttendance.filter(a => a.user_id === m.id && (a.status === 'PRESENT' || !a.status));
      const presentCount = records.length;
      const rate = Math.min(100, Math.round((presentCount / totalSessions) * 100));
      return {
        ...m,
        presentCount,
        rate
      };
    });

    // Sort descending by presentCount, then rate, then name
    rankedList.sort((a, b) => {
      if (b.presentCount !== a.presentCount) return b.presentCount - a.presentCount;
      if (b.rate !== a.rate) return b.rate - a.rate;
      return (a.name || '').localeCompare(b.name || '');
    });

    if (rankedList.length === 0 || STATE.adminAttendance.length === 0) {
      container.innerHTML = `
        <div class="py-12 flex flex-col items-center justify-center text-center px-4">
          <div class="w-24 h-24 relative mb-3 ghost-float">
            <svg class="w-24 h-24 drop-shadow-[0_12px_24px_rgba(0,0,0,0.6)]" viewBox="0 0 120 120" fill="none">
              <path d="M60 20C41 20 28 35 28 54C28 72 25 89 33 93C39 96 44 89 50 91C56 93 57 97 63 97C69 97 71 92 77 92C83 92 86 96 92 92C97 88 92 70 92 54C92 35 79 20 60 20Z" fill="url(#ghostBodyGrad)"></path>
              <ellipse cx="50" cy="50" fill="#040A18" rx="3.5" ry="4.5"></ellipse>
              <ellipse cx="70" cy="50" fill="#040A18" rx="3.5" ry="4.5"></ellipse>
              <circle cx="51.5" cy="48.5" fill="#FFFFFF" r="1.4"></circle>
              <circle cx="71.5" cy="48.5" fill="#FFFFFF" r="1.4"></circle>
              <circle cx="43" cy="57" fill="#60A5FA" fill-opacity="0.5" r="3.2"></circle>
              <circle cx="77" cy="57" fill="#60A5FA" fill-opacity="0.5" r="3.2"></circle>
              <path d="M57 58C58.8 60 61.2 60 63 58" stroke="#0B2042" stroke-linecap="round" stroke-width="1.8"></path>
            </svg>
          </div>
          <p class="text-base font-bold text-white">No Attendance Marked Yet</p>
          <p class="text-xs text-white/50 mt-1 max-w-[260px]">Members will automatically appear on the ranked leaderboard as soon as daily attendance is checked in.</p>
        </div>
      `;
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'space-y-3';

    // Summary banner
    const summary = document.createElement('div');
    summary.className = 'zentra-card p-3.5 rounded-2xl flex items-center justify-between text-xs border border-white/10 shadow-sm';
    summary.innerHTML = `
      <div>
        <span class="text-white/50 text-[10px] uppercase font-bold tracking-wider block">Club Sessions</span>
        <span class="text-sm font-black text-white">${totalSessions} Days Recorded</span>
      </div>
      <div class="text-right">
        <span class="text-white/50 text-[10px] uppercase font-bold tracking-wider block">Active Members</span>
        <span class="text-sm font-black text-[#529BF8]">${rankedList.filter(r => r.presentCount > 0).length} / ${rankedList.length}</span>
      </div>
    `;
    wrapper.appendChild(summary);

    // Render ranked members
    rankedList.forEach((member, index) => {
      const rank = index + 1;
      const isTop1 = rank === 1;
      const isTop2 = rank === 2;
      const isTop3 = rank === 3;

      let rankBadgeHtml = '';
      let cardBorderClass = 'border-white/10';

      if (isTop1) {
        rankBadgeHtml = `<span class="px-2 py-0.5 rounded-lg bg-gradient-to-r from-amber-400 to-yellow-500 text-black text-[11px] font-black shadow-sm flex items-center space-x-1"><span>🥇</span><span>#1</span></span>`;
        cardBorderClass = 'border-amber-400/40 shadow-[0_0_24px_rgba(251,191,36,0.12)]';
      } else if (isTop2) {
        rankBadgeHtml = `<span class="px-2 py-0.5 rounded-lg bg-gradient-to-r from-slate-200 to-slate-400 text-black text-[11px] font-black shadow-sm flex items-center space-x-1"><span>🥈</span><span>#2</span></span>`;
        cardBorderClass = 'border-slate-300/35';
      } else if (isTop3) {
        rankBadgeHtml = `<span class="px-2 py-0.5 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 text-white text-[11px] font-black shadow-sm flex items-center space-x-1"><span>🥉</span><span>#3</span></span>`;
        cardBorderClass = 'border-amber-600/35';
      } else {
        rankBadgeHtml = `<span class="w-6 h-6 rounded-lg bg-white/10 text-white/80 font-mono text-xs font-bold flex items-center justify-center">#${rank}</span>`;
      }

      const card = document.createElement('div');
      card.className = `zentra-card-elevated p-3.5 rounded-2xl border ${cardBorderClass} space-y-2.5`;
      card.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2.5 truncate pr-2">
            ${rankBadgeHtml}
            <div class="truncate">
              <div class="flex items-center space-x-1.5 flex-wrap">
                <span class="text-sm font-bold text-white truncate">${member.name}</span>
                ${member.roll_no ? `<span class="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">${member.roll_no}</span>` : ''}
              </div>
              <p class="text-[11px] text-white/50 truncate mt-0.5">
                ${member.department ? `${member.department} • ` : ''}${member.batch_year ? `${member.batch_year} Batch` : ''}
              </p>
            </div>
          </div>
          <div class="text-right flex-shrink-0">
            <span class="text-sm font-black text-white">${member.presentCount} <span class="text-[10px] font-normal text-white/50">Days</span></span>
            <span class="text-[10px] font-bold block text-[#529BF8]">${member.rate}% Rate</span>
          </div>
        </div>

        <!-- Attendance Progress Bar -->
        <div class="w-full bg-white/[0.08] rounded-full h-1.5 overflow-hidden">
          <div class="h-full rounded-full ${isTop1 ? 'bg-gradient-to-r from-amber-400 to-yellow-500' : 'bg-gradient-to-r from-[#2F7FF5] to-[#529BF8]'}" style="width: ${member.rate}%"></div>
        </div>
      `;
      wrapper.appendChild(card);
    });

    container.appendChild(wrapper);
    return;
  }

  // -------------------------------------------------------------
  // VIEW 3: ATTENDANCE LOGS ('attendance')
  // -------------------------------------------------------------
  if (STATE.adminActiveTab === 'attendance') {
    if (STATE.adminAttendance.length === 0) {
      container.innerHTML = `<div class="py-16 text-center text-white/40 text-xs">No attendance records found yet.</div>`;
      return;
    }

    const list = document.createElement('div');
    list.className = 'space-y-2.5';

    STATE.adminAttendance.forEach(rec => {
      const memberName = (rec.profiles && rec.profiles.name) || 'Unknown Member';
      const memberRoll = (rec.profiles && rec.profiles.roll_no) || '';
      const memberDept = (rec.profiles && rec.profiles.department) || '';
      const dateLabel = formatDateLabel(rec.attendance_date);
      const timeLabel = formatTimeString(rec.created_at);

      const row = document.createElement('div');
      row.className = 'zentra-card-elevated p-3.5 rounded-2xl flex items-center justify-between border border-white/10';
      row.innerHTML = `
        <div class="flex items-center space-x-3 truncate">
          <div class="w-8 h-8 rounded-xl bg-[#2F7FF5]/20 text-[#529BF8] border border-[#2F7FF5]/30 flex items-center justify-center font-bold text-xs flex-shrink-0">
            ✓
          </div>
          <div class="truncate">
            <div class="flex items-center space-x-1.5 truncate">
              <p class="text-sm font-bold text-white truncate">${memberName}</p>
              ${memberRoll ? `<span class="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">${memberRoll}</span>` : ''}
            </div>
            <p class="text-[11px] text-white/50 truncate">${memberDept ? `${memberDept} • ` : ''}${dateLabel} at ${timeLabel}</p>
          </div>
        </div>
        <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#2F7FF5]/15 text-[#529BF8] border border-[#2F7FF5]/30 flex-shrink-0 ml-2">
          PRESENT
        </span>
      `;
      list.appendChild(row);
    });

    container.appendChild(list);
    return;
  }

  // -------------------------------------------------------------
  // VIEW 4: ALL MEMBERS LIST ('all')
  // -------------------------------------------------------------
  const listToRender = STATE.adminUsers;

  if (listToRender.length === 0) {
    container.innerHTML = `
      <div class="py-12 flex flex-col items-center justify-center text-center px-4">
        <p class="text-sm font-bold text-white">No members found</p>
        <p class="text-xs text-white/50 mt-1 max-w-[240px]">No registered club members in database.</p>
      </div>
    `;
    return;
  }

  const list = document.createElement('div');
  list.className = 'space-y-2.5';

  listToRender.forEach(user => {
    const isPending = user.approval_status === 'pending';
    const isAdminUser = user.role === 'admin';

    const card = document.createElement('div');
    card.className = 'zentra-card-elevated p-3.5 rounded-2xl border border-white/10 space-y-2.5';
    card.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="truncate pr-2">
          <div class="flex items-center space-x-1.5 flex-wrap">
            <span class="text-sm font-bold text-white truncate">${user.name}</span>
            ${user.roll_no ? `<span class="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">${user.roll_no}</span>` : ''}
            ${isAdminUser ? '<span class="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">Admin</span>' : ''}
          </div>
          <p class="text-[11px] text-white/50 truncate mt-0.5">
            ${user.department ? `${user.department} • ` : ''}${user.batch_year ? `${user.batch_year} Batch • ` : ''}${user.identifier}
          </p>
        </div>
        <span class="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full flex-shrink-0 ${
          isPending 
            ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30' 
            : 'bg-emerald-400/15 text-emerald-300 border border-emerald-400/30'
        }">
          ${user.approval_status}
        </span>
      </div>

      <div class="flex items-center justify-end space-x-2 pt-1 border-t border-white/[0.05]">
        ${isPending ? `
          <button onclick="adminApproveUser('${user.id}')" class="tap-scale px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold transition shadow-sm">
            ✓ Approve
          </button>
        ` : ''}
        ${!isAdminUser ? `
          <button onclick="openAdminDeleteModal('${user.id}', '${encodeURIComponent(user.name)}')" class="tap-scale px-3 py-1.5 rounded-xl bg-[#FF453A]/15 text-[#FF453A] border border-[#FF453A]/30 text-xs font-bold hover:bg-[#FF453A]/25 transition">
            Delete
          </button>
        ` : ''}
      </div>
    `;
    list.appendChild(card);
  });

  container.appendChild(list);
}

function setAdminTab(tab) {
  STATE.adminActiveTab = tab;
  const tabPending = document.getElementById('adminTabPending');
  const tabRank = document.getElementById('adminTabRank');
  const tabAll = document.getElementById('adminTabAll');
  const tabAtt = document.getElementById('adminTabAtt');

  [tabPending, tabRank, tabAll, tabAtt].forEach(t => {
    if (t) t.className = "tap-scale flex-1 py-2 rounded-xl text-white/60 hover:text-white text-center transition";
  });

  const activeBtn = tab === 'pending' ? tabPending : tab === 'rank' ? tabRank : tab === 'all' ? tabAll : tabAtt;
  if (activeBtn) {
    activeBtn.className = "tap-scale flex-1 py-2 rounded-xl bg-gradient-to-r from-[#2F7FF5] to-[#4FA1FF] text-white text-center font-bold shadow-md transition";
  }

  updateNavIcons('admin');
  renderAdminUI();
}

async function adminApproveUser(userId) {
  if (!STATE.supabase) return;
  showGhostLoading("Approving member...");
  try {
    const { error } = await STATE.supabase
      .from('profiles')
      .update({ approval_status: 'approved' })
      .eq('id', userId);

    if (error) throw error;

    playChime(true);
    showToast("✓ Member approved successfully");
    await loadAdminData();
  } catch (err) {
    console.error("Approve failed:", err);
    showToast("Failed to approve member: " + err.message);
  } finally {
    hideGhostLoading();
  }
}

async function adminApproveAllUsers() {
  if (!STATE.supabase || !STATE.adminPendingUsers || STATE.adminPendingUsers.length === 0) return;
  showGhostLoading("Approving all members in queue...");
  try {
    const ids = STATE.adminPendingUsers.map(u => u.id);
    const { error } = await STATE.supabase
      .from('profiles')
      .update({ approval_status: 'approved' })
      .in('id', ids);

    if (error) throw error;

    playChime(true);
    showToast(`✓ Approved ${ids.length} members!`);
    await loadAdminData();
  } catch (err) {
    console.error("Batch approve failed:", err);
    showToast("Batch approve error: " + err.message);
  } finally {
    hideGhostLoading();
  }
}

// ------------------------------------------------------------------------------
// 8. DATABASE DANGER ZONE: COMPLETE DATA WIPE & RESET
// ------------------------------------------------------------------------------
function openDataWipeModal() {
  const modal = document.getElementById('dataWipeModal');
  const input = document.getElementById('wipeConfirmInput');
  const btn = document.getElementById('confirmWipeBtn');
  if (input) input.value = '';
  if (btn) {
    btn.disabled = true;
    btn.className = "tap-scale flex-1 py-3.5 rounded-2xl bg-red-600/30 text-white/40 text-xs font-bold transition shadow-lg disabled:cursor-not-allowed";
  }
  if (modal) modal.classList.remove('hidden');
}

function closeDataWipeModal() {
  const modal = document.getElementById('dataWipeModal');
  if (modal) modal.classList.add('hidden');
}

function handleWipeInputChange(val) {
  const btn = document.getElementById('confirmWipeBtn');
  if (!btn) return;
  const isMatch = val.trim().toUpperCase() === 'DELETE';
  btn.disabled = !isMatch;
  btn.className = isMatch
    ? "tap-scale flex-1 py-3.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-lg transition"
    : "tap-scale flex-1 py-3.5 rounded-2xl bg-red-600/30 text-white/40 text-xs font-bold transition shadow-lg disabled:cursor-not-allowed";
}

async function executeDataWipe() {
  const scopeEl = document.querySelector('input[name="wipeScope"]:checked');
  const scope = scopeEl ? scopeEl.value : 'attendance';

  closeDataWipeModal();
  showGhostLoading(scope === 'all' ? "Wiping complete Supabase database..." : "Clearing all attendance records...");

  try {
    // 1. Wipe all attendance records
    const { error: attDelErr } = await STATE.supabase
      .from('attendance')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (attDelErr) throw attDelErr;

    // 2. If complete factory wipe, delete all non-admin club members
    if (scope === 'all') {
      const nonAdmins = (STATE.adminUsers || []).filter(u => u.role !== 'admin');
      for (const user of nonAdmins) {
        try {
          await STATE.supabase.rpc('admin_delete_user', { target_user_id: user.id });
        } catch (delErr) {
          console.warn("Delete user cascade:", delErr);
        }
      }
      // Also delete from profiles directly as admin
      await STATE.supabase
        .from('profiles')
        .delete()
        .neq('role', 'admin');
    }

    playChime(true);
    showToast(scope === 'all' ? "✓ All data wiped from Supabase!" : "✓ All attendance logs wiped!");
    await loadAdminData();
  } catch (err) {
    console.error("Data wipe failed:", err);
    showToast("Wipe failed: " + err.message);
  } finally {
    hideGhostLoading();
  }
}

function openAdminDeleteModal(userId, encodedName) {
  STATE.userToDelete = { id: userId, name: decodeURIComponent(encodedName) };
  const modal = document.getElementById('adminDeleteModal');
  const nameText = document.getElementById('adminDeleteUserName');
  if (nameText) nameText.textContent = STATE.userToDelete.name;
  if (modal) modal.classList.remove('hidden');
}

function closeAdminDeleteModal() {
  STATE.userToDelete = null;
  const modal = document.getElementById('adminDeleteModal');
  if (modal) modal.classList.add('hidden');
}

async function confirmAdminDeleteUser() {
  if (!STATE.userToDelete || !STATE.supabase) return;
  const targetId = STATE.userToDelete.id;
  closeAdminDeleteModal();

  try {
    // Call the PostgreSQL admin_delete_user function which removes from auth.users cascading to profile & attendance
    const { error: rpcErr } = await STATE.supabase.rpc('admin_delete_user', { target_user_id: targetId });
    if (rpcErr) {
      // Fallback: delete directly from public.profiles
      const { error: delErr } = await STATE.supabase.from('profiles').delete().eq('id', targetId);
      if (delErr) throw delErr;
    }

    playChime(false);
    showToast("User deleted");
    await loadAdminData();
  } catch (err) {
    console.error("Delete user failed:", err);
    showToast("Failed to delete user: " + err.message);
  }
}

// ------------------------------------------------------------------------------
// 8. CSV EXPORT FOR EXCEL & GOOGLE SHEETS
// ------------------------------------------------------------------------------
async function downloadAttendanceCSV() {
  if (!STATE.currentUser || STATE.currentUser.role !== 'admin' || !STATE.supabase) {
    showToast("Only admins can download CSV");
    return;
  }

  showGhostLoading("Preparing CSV export...");

  try {
    // Fetch all attendance records with user profile details
    const { data: records, error } = await STATE.supabase
      .from('attendance')
      .select('*, profiles(name, identifier, roll_no, department, batch_year)')
      .order('attendance_date', { ascending: false });

    if (error) throw error;

    if (!records || records.length === 0) {
      showToast("No attendance data to download");
      return;
    }

    // CSV Header row including academic fields
    const headers = ['Member Name', 'Roll Number', 'Department', 'Batch Year', 'Email or Phone', 'Date', 'Attendance Status', 'Attendance Time'];
    const rows = [headers];

    // Build data rows
    records.forEach(rec => {
      const p = rec.profiles || {};
      const name = p.name ? `"${p.name.replace(/"/g, '""')}"` : '""';
      const roll = p.roll_no ? `"${p.roll_no.replace(/"/g, '""')}"` : '""';
      const dept = p.department ? `"${p.department.replace(/"/g, '""')}"` : '""';
      const year = p.batch_year ? `"${p.batch_year.replace(/"/g, '""')}"` : '""';
      const identifier = p.identifier ? `"${p.identifier.replace(/"/g, '""')}"` : '""';
      const date = `"${rec.attendance_date}"`;
      const status = `"${rec.status || 'PRESENT'}"`;
      const time = `"${formatTimeString(rec.created_at)}"`;

      rows.push([name, roll, dept, year, identifier, date, status, time]);
    });

    const csvContent = '\uFEFF' + rows.map(r => r.join(',')).join('\r\n'); // \uFEFF BOM for Excel utf-8 support
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    const today = getTodayDateString();
    a.download = `attendance_report_${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    playChime(true);
    showToast("✓ CSV Downloaded");
  } catch (err) {
    console.error("CSV download error:", err);
    showToast("Failed to export CSV: " + err.message);
  } finally {
    hideGhostLoading();
  }
}

// ------------------------------------------------------------------------------
// 9. PWA INSTALLATION PROMPT HANDLERS
// ------------------------------------------------------------------------------
function setupPwa() {
  // Register Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        console.log('✓ Service Worker registered successfully:', reg.scope);
      })
      .catch(err => {
        console.warn('Service Worker registration failed:', err);
      });
  }

  // Handle Chrome / Android beforeinstallprompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    STATE.pwaInstallPrompt = e;
    console.log('✓ Chrome beforeinstallprompt detected: PWA installable (running in browser mode)');
    // Banner is kept hidden by default so users can use the app directly in their mobile browser without install
  });

  // Handle Chrome appinstalled event
  window.addEventListener('appinstalled', (evt) => {
    console.log('✓ Manavar Illam PWA successfully installed in Chrome/OS');
    STATE.pwaInstallPrompt = null;
    dismissPwaBanner();
    showToast("✓ App installed to Home Screen");
  });

  // Check if standalone (already installed or running inside PWA wrapper)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (isStandalone) {
    dismissPwaBanner();
  } else if (sessionStorage.getItem('PWA_BANNER_DISMISSED') === '1') {
    const banner = document.getElementById('pwaBanner');
    if (banner) banner.classList.add('hidden');
  }
}

function handleInstallPwa() {
  if (STATE.pwaInstallPrompt) {
    STATE.pwaInstallPrompt.prompt();
    STATE.pwaInstallPrompt.userChoice.then(choiceResult => {
      if (choiceResult.outcome === 'accepted') {
        showToast("✓ Added to Home Screen");
        dismissPwaBanner();
      }
      STATE.pwaInstallPrompt = null;
    });
  } else {
    // Chrome Desktop, Android, or iOS fallback
    const isIos = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    const isChrome = /chrome|crios/.test(navigator.userAgent.toLowerCase()) && !/edge|edg/.test(navigator.userAgent.toLowerCase());
    if (isIos) {
      alert("To install on iPhone:\n1. Tap the Share button (square with arrow ↑) at the bottom.\n2. Scroll down and tap 'Add to Home Screen'.");
    } else if (isChrome) {
      showToast("Tap Chrome ⋮ menu and select 'Install app' or 'Add to Home screen'");
    } else {
      showToast("Use your browser menu to 'Install app' or 'Add to Home screen'");
    }
  }
}

function dismissPwaBanner() {
  sessionStorage.setItem('PWA_BANNER_DISMISSED', '1');
  const banner = document.getElementById('pwaBanner');
  if (!banner) return;
  banner.style.opacity = '0';
  banner.style.transform = 'translateY(100%)';
  setTimeout(() => banner.classList.add('hidden'), 300);
}

// ------------------------------------------------------------------------------
// 11. INITIALIZATION ON PAGE LOAD
// ------------------------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  setupDateDisplay();
  setupPwa();
  checkAuthSession();
});
