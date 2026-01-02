// 🔥 BVM Alumni Portal - Complete Firebase Logic
// STEP 1: Replace firebaseConfig with YOUR credentials from Firebase Console


// 🔥 BVM Alumni Portal - Complete Firebase Logic (Compat SDK)
// STEP 1: Replace firebaseConfig with YOUR credentials from Firebase Console

const firebaseConfig = {
   apiKey: "AIzaSyDRPotcu3E1MZ7-PdkwHqqmD0Qr_tMeXFs",
  authDomain: "first-fc9ce.firebaseapp.com",
  databaseURL: "https://first-fc9ce-default-rtdb.firebaseio.com",
  projectId: "first-fc9ce",
  storageBucket: "first-fc9ce.firebasestorage.app",
  messagingSenderId: "647342130562",
  appId: "1:647342130562:web:f348cf055427107596bb9b",
  measurementId: "G-C5EH80M7T1"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const rtdb = firebase.database();

// Global State
let currentUser = null;
let currentRole = null;
let currentChatWith = null;

// ==========================================
// AUTH FUNCTIONS
// ==========================================

function switchTab(tab) {
  document.getElementById('loginForm').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('registerForm').style.display = tab === 'register' ? 'block' : 'none';
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
}

document.getElementById('regRole').addEventListener('change', function() {
  document.getElementById('alumniRegFields').style.display = this.value === 'alumni' ? 'block' : 'none';
  document.getElementById('studentRegFields').style.display = this.value === 'student' ? 'block' : 'none';
});

async function registerUser() {
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value.trim();
  const role = document.getElementById('regRole').value;

  if (!name || !email || !password) {
    showAlert('registerAlert', 'Fill all fields', 'error');
    return;
  }

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    const uid = cred.user.uid;

    let userData = {
      email, role, name,
      verified: role === 'alumni' ? false : true,
      createdAt: new Date()
    };

    if (role === 'alumni') {
      userData.gradYear = document.getElementById('regGradYear').value;
      userData.jobTitle = document.getElementById('regJobTitle').value;
      userData.company = document.getElementById('regCompany').value;
      userData.skills = document.getElementById('regSkills').value.split(',').map(s => s.trim()).filter(Boolean);
      userData.interests = document.getElementById('regInterests').value.split(',').map(i => i.trim()).filter(Boolean);
    } else if (role === 'student') {
      userData.collegeId = document.getElementById('regCollegeId').value;
    }

    await db.collection('users').doc(uid).set(userData);
    showAlert('registerAlert', 'Registered! Please login.', 'success');
    setTimeout(() => switchTab('login'), 1500);
  } catch (error) {
    showAlert('registerAlert', error.message, 'error');
  }
}

async function loginUser() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  const role = document.getElementById('loginRole').value;

  if (!email || !password) {
    showAlert('loginAlert', 'Fill all fields', 'error');
    return;
  }

  try {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    const userDoc = await db.collection('users').doc(cred.user.uid).get();
    if (!userDoc.data().role === role) {
      await auth.signOut();
      showAlert('loginAlert', 'Wrong role selected', 'error');
      return;
    }
    showAlert('loginAlert', '', 'success');
  } catch (error) {
    showAlert('loginAlert', error.message, 'error');
  }
}

async function logoutUser() {
  await auth.signOut();
  currentUser = null;
  currentRole = null;
  document.getElementById('authSection').classList.remove('hidden');
  document.getElementById('mainContent').classList.add('hidden');
}

// Auth State Listener
auth.onAuthStateChanged(async (user) => {
  document.getElementById('loadingScreen').style.display = 'none';

  if (!user) {
    document.getElementById('authSection').classList.remove('hidden');
    document.getElementById('mainContent').classList.add('hidden');
    return;
  }

  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (!userDoc.exists) {
      await auth.signOut();
      return;
    }

    currentUser = { uid: user.uid, ...userDoc.data() };
    currentRole = currentUser.role;

    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('mainContent').classList.remove('hidden');

    updateUI();
    loadFeed();
  } catch (error) {
    console.error('Auth error:', error);
  }
});

// ==========================================
// UI FUNCTIONS
// ==========================================

function updateUI() {
  document.getElementById('userDisplay').textContent = `${currentUser.name} (${currentRole})`;
  updateSidebar();
}

function updateSidebar() {
  const menu = document.getElementById('sidebarMenu');
  menu.innerHTML = '';

  const addMenuItem = (label, view) => {
    const btn = document.createElement('button');
    btn.className = 'sidebar-item';
    btn.textContent = label;
    btn.onclick = () => showView(view);
    menu.appendChild(btn);
  };

  addMenuItem('📋 Feed', 'feedView');

  if (currentRole === 'alumni') {
    addMenuItem('✍️ Create Post', 'createPostView');
    addMenuItem('👤 My Profile', 'profileView');
    addMenuItem('🎯 Office Hours', 'rouletteView');
  }

  if (currentRole === 'student') {
    addMenuItem('💬 Chat', 'chatView');
    addMenuItem('🎯 Office Hours', 'rouletteView');
  }

  if (currentRole === 'admin') {
    addMenuItem('👑 Admin', 'adminView');
  }

  document.getElementById('filterSection').style.display = currentRole === 'student' ? 'block' : 'none';

  if (currentRole === 'alumni') {
    document.getElementById('alumniRoulette').style.display = 'block';
    document.getElementById('studentRoulette').style.display = 'none';
  } else if (currentRole === 'student') {
    document.getElementById('alumniRoulette').style.display = 'none';
    document.getElementById('studentRoulette').style.display = 'block';
  }
}

function showView(viewId) {
  document.querySelectorAll('.view-page').forEach(v => v.style.display = 'none');
  document.getElementById(viewId).style.display = 'block';

  if (viewId === 'feedView') loadFeed();
  if (viewId === 'profileView') loadProfile();
  if (viewId === 'adminView') loadAdmin();
}

function showAlert(elementId, message, type) {
  const el = document.getElementById(elementId);
  if (message) {
    el.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
  } else {
    el.innerHTML = '';
  }
}

// ==========================================
// FEED FUNCTIONS
// ==========================================

async function loadFeed() {
  const container = document.getElementById('feedContainer');
  container.innerHTML = '<p style="text-align:center;">Loading...</p>';

  try {
    if (currentRole === 'student') {
      const snapshot = await db.collection('users')
        .where('role', '==', 'alumni')
        .where('verified', '==', true)
        .get();

      container.innerHTML = '';
      if (snapshot.empty) {
        container.innerHTML = '<p style="text-align:center; color:#999;">No alumni found</p>';
        return;
      }

      snapshot.forEach(doc => {
        const alumni = doc.data();
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
          <h3>${alumni.name}</h3>
          <p><strong>${alumni.jobTitle || 'N/A'}</strong> @ ${alumni.company || 'N/A'}</p>
          <p style="color:#666; font-size:12px;">Skills: ${(alumni.skills || []).join(', ') || 'N/A'}</p>
          <p style="color:#666; font-size:12px;">Interests: ${(alumni.interests || []).join(', ') || 'N/A'}</p>
          <button class="btn btn-primary" onclick="startChat('${doc.id}', '${alumni.name}')">Chat</button>
        `;
        container.appendChild(card);
      });
    } else {
      const snapshot = await db.collection('posts').orderBy('createdAt', 'desc').get();

      container.innerHTML = '';
      if (snapshot.empty) {
        container.innerHTML = '<p style="text-align:center; color:#999;">No posts yet</p>';
        return;
      }

      snapshot.forEach(doc => {
        const post = doc.data();
        if (currentRole === 'admin' || post.approved || post.authorId === currentUser.uid) {
          const card = document.createElement('div');
          card.className = 'card';
          card.innerHTML = `
            <h3>${post.title}</h3>
            <p style="color:#666; font-size:12px;">${post.type.toUpperCase()} | ${post.approved ? '✓ Approved' : '⏳ Pending'}</p>
            <p>${post.description}</p>
            ${post.authorId === currentUser.uid ? `<button class="btn btn-danger" onclick="deletePost('${doc.id}')">Delete</button>` : ''}
          `;
          container.appendChild(card);
        }
      });
    }
  } catch (error) {
    container.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
  }
}

// ==========================================
// POST FUNCTIONS
// ==========================================

document.getElementById('btnCreatePost').addEventListener('click', async () => {
  const title = document.getElementById('postTitle').value.trim();
  const desc = document.getElementById('postDesc').value.trim();
  const type = document.getElementById('postType').value;

  if (!title || !desc) {
    showAlert('createPostAlert', 'Fill all fields', 'error');
    return;
  }

  try {
    await db.collection('posts').add({
      title, 
      description: desc, 
      type,
      authorId: currentUser.uid,
      approved: false,
      createdAt: new Date()
    });
    showAlert('createPostAlert', 'Post submitted for review!', 'success');
    document.getElementById('postTitle').value = '';
    document.getElementById('postDesc').value = '';
    setTimeout(() => loadFeed(), 1000);
  } catch (error) {
    showAlert('createPostAlert', error.message, 'error');
  }
});

async function deletePost(postId) {
  if (confirm('Delete this post?')) {
    await db.collection('posts').doc(postId).delete();
    loadFeed();
  }
}

// ==========================================
// PROFILE FUNCTIONS
// ==========================================

async function loadProfile() {
  if (currentRole !== 'alumni') return;

  const user = currentUser;
  document.getElementById('profName').value = user.name || '';
  document.getElementById('profJobTitle').value = user.jobTitle || '';
  document.getElementById('profCompany').value = user.company || '';
  document.getElementById('profSkills').value = (user.skills || []).join(', ');
  document.getElementById('profInterests').value = (user.interests || []).join(', ');
}

document.getElementById('btnSaveProfile').addEventListener('click', async () => {
  try {
    await db.collection('users').doc(currentUser.uid).update({
      name: document.getElementById('profName').value,
      jobTitle: document.getElementById('profJobTitle').value,
      company: document.getElementById('profCompany').value,
      skills: document.getElementById('profSkills').value.split(',').map(s => s.trim()).filter(Boolean),
      interests: document.getElementById('profInterests').value.split(',').map(i => i.trim()).filter(Boolean)
    });
    showAlert('profileAlert', 'Profile updated!', 'success');
    // Update local state
    currentUser.name = document.getElementById('profName').value;
    currentUser.jobTitle = document.getElementById('profJobTitle').value;
    currentUser.company = document.getElementById('profCompany').value;
  } catch (error) {
    showAlert('profileAlert', error.message, 'error');
  }
});

// ==========================================
// CHAT FUNCTIONS
// ==========================================

async function startChat(alumniId, alumniName) {
  currentChatWith = { id: alumniId, name: alumniName };
  showView('chatView');
  loadChatMessages();
}

async function loadChatMessages() {
  if (!currentChatWith) return;

  const chatId = [currentUser.uid, currentChatWith.id].sort().join('_');
  const messagesEl = document.getElementById('chatMessages');
  messagesEl.innerHTML = '';

  rtdb.ref(`messages/${chatId}`).on('child_added', (snap) => {
    const msg = snap.val();
    const div = document.createElement('div');
    div.className = msg.senderId === currentUser.uid ? 'msg-sent' : 'msg-received';
    div.innerHTML = `<p>${msg.text}</p><small>${new Date(msg.time).toLocaleTimeString()}</small>`;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });
}

document.getElementById('btnSendMessage').addEventListener('click', async () => {
  if (!currentChatWith) {
    alert('Select an alumni first');
    return;
  }

  const text = document.getElementById('chatInput').value.trim();
  if (!text) return;

  const chatId = [currentUser.uid, currentChatWith.id].sort().join('_');
  await rtdb.ref(`messages/${chatId}`).push({
    senderId: currentUser.uid,
    text,
    time: Date.now()
  });

  document.getElementById('chatInput').value = '';
});

// Load alumni list for chat
async function loadChatAlumni() {
  const select = document.getElementById('chatSelect');
  const snapshot = await db.collection('users')
    .where('role', '==', 'alumni')
    .where('verified', '==', true)
    .get();

  snapshot.forEach(doc => {
    const opt = document.createElement('option');
    opt.value = doc.id;
    opt.textContent = doc.data().name;
    select.appendChild(opt);
  });

  select.addEventListener('change', () => {
    if (select.value) {
      const alumni = snapshot.docs.find(d => d.id === select.value).data();
      startChat(select.value, alumni.name);
    }
  });
}

// ==========================================
// OFFICE HOURS ROULETTE
// ==========================================

function setupPresence() {
  if (currentRole !== 'alumni') return;

  const presenceRef = rtdb.ref(`presence/${currentUser.uid}`);
  presenceRef.onDisconnect().set({ state: 'offline', time: Date.now() });
  presenceRef.set({ state: 'online', time: Date.now() });
}

document.getElementById('btnUpdateLive').addEventListener('click', async () => {
  const isLive = document.getElementById('alumniLiveToggle').checked;
  const question = document.getElementById('alumniDefaultQuestion').value.trim();

  try {
    await db.collection('users').doc(currentUser.uid).update({
      isLive,
      defaultQuestion: question
    });

    await rtdb.ref(`liveAlumni/${currentUser.uid}`).set({
      isLive,
      name: currentUser.name,
      updatedAt: Date.now()
    });

    alert(isLive ? '✅ You are now LIVE!' : '❌ You are offline');
  } catch (error) {
    alert('Error: ' + error.message);
  }
});

document.getElementById('btnFindAlumni').addEventListener('click', async () => {
  const question = document.getElementById('studentQuestion').value.trim();
  const statusDiv = document.getElementById('rouletteStatus');
  statusDiv.innerHTML = '<p>Finding live alumni...</p>';

  try {
    const snapshot = await db.collection('users')
      .where('role', '==', 'alumni')
      .where('verified', '==', true)
      .where('isLive', '==', true)
      .get();

    if (snapshot.empty) {
      statusDiv.innerHTML = '<p style="color:#666;">No alumni live right now. Try again later!</p>';
      return;
    }

    const alumni = snapshot.docs[Math.floor(Math.random() * snapshot.docs.length)];
    const alumniData = alumni.data();

    statusDiv.innerHTML = `
      <p><strong>Matched with ${alumniData.name}</strong></p>
      <p>Your question: ${question}</p>
      <a href="https://meet.google.com/" target="_blank" class="btn btn-primary">Join 5-min Call</a>
    `;

    await db.collection('roulette_sessions').add({
      studentId: currentUser.uid,
      alumniId: alumni.id,
      question,
      timestamp: new Date()
    });
  } catch (error) {
    statusDiv.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
  }
});

// ==========================================
// ADMIN FUNCTIONS
// ==========================================

async function loadAdmin() {
  const pendingAlumniDiv = document.getElementById('pendingAlumniList');
  const pendingPostsDiv = document.getElementById('pendingPostsList');

  try {
    const alumniSnapshot = await db.collection('users')
      .where('role', '==', 'alumni')
      .where('verified', '==', false)
      .get();

    pendingAlumniDiv.innerHTML = '';
    if (alumniSnapshot.empty) {
      pendingAlumniDiv.innerHTML = '<p style="color:#999;">No pending alumni</p>';
    } else {
      alumniSnapshot.forEach(doc => {
        const alumni = doc.data();
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
          <h4>${alumni.name}</h4>
          <p>${alumni.jobTitle} @ ${alumni.company}</p>
          <button class="btn btn-primary" onclick="approveAlumni('${doc.id}')">Approve</button>
          <button class="btn btn-danger" onclick="rejectAlumni('${doc.id}')">Reject</button>
        `;
        pendingAlumniDiv.appendChild(div);
      });
    }

    const postsSnapshot = await db.collection('posts')
      .where('approved', '==', false)
      .get();

    pendingPostsDiv.innerHTML = '';
    if (postsSnapshot.empty) {
      pendingPostsDiv.innerHTML = '<p style="color:#999;">No pending posts</p>';
    } else {
      postsSnapshot.forEach(doc => {
        const post = doc.data();
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
          <h4>${post.title}</h4>
          <p>${post.description}</p>
          <button class="btn btn-primary" onclick="approvePost('${doc.id}')">Approve</button>
          <button class="btn btn-danger" onclick="rejectPost('${doc.id}')">Reject</button>
        `;
        pendingPostsDiv.appendChild(div);
      });
    }
  } catch (error) {
    console.error('Admin load error:', error);
  }
}

async function approveAlumni(uid) {
  await db.collection('users').doc(uid).update({ verified: true });
  loadAdmin();
}

async function rejectAlumni(uid) {
  await db.collection('users').doc(uid).delete();
  loadAdmin();
}

async function approvePost(postId) {
  await db.collection('posts').doc(postId).update({ approved: true });
  loadAdmin();
  loadFeed();
}

async function rejectPost(postId) {
  await db.collection('posts').doc(postId).delete();
  loadAdmin();
  loadFeed();
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function applyAlumniFilters() {
  loadFeed();
}

// Event Listeners
document.getElementById('btnRegister').addEventListener('click', registerUser);
document.getElementById('btnLogin').addEventListener('click', loginUser);
document.getElementById('btnLogout').addEventListener('click', logoutUser);
document.getElementById('btnLogoutSidebar').addEventListener('click', logoutUser);

// Initialize on load
window.addEventListener('load', () => {
  setupPresence();
  if (currentRole === 'student') {
    loadChatAlumni();
  }
});