// 🔥 BVM Alumni Portal - Complete Firebase Logic
// STEP 1: Replace firebaseConfig with YOUR credentials from Firebase Console


// 🔥 BVM Alumni Portal - Complete Firebase Logic (Compat SDK)
// STEP 1: Replace firebaseConfig with YOUR credentials from Firebase Console
let chatUsersUnsubscribe = null;
let activeChatRef = null;

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

function switchTab(tab, event) {
  document.getElementById('loginForm').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('registerForm').style.display = tab === 'register' ? 'block' : 'none';
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  if (event && event.target) {
    event.target.classList.add('active');
  } else {
    // Fallback: activate the tab based on the tab parameter
    document.querySelectorAll('.auth-tab').forEach(t => {
      if ((tab === 'login' && t.textContent.trim().toLowerCase() === 'login') ||
          (tab === 'register' && t.textContent.trim().toLowerCase() === 'register')) {
        t.classList.add('active');
      }
    });
  }
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

  // VALIDATION: Check all fields
  if (!name || !email || !password) {
    showAlert('registerAlert', 'Fill all fields', 'error');
    return;
  }

  // VALIDATION: Students MUST use college email
  if (role === 'student') {
    if (!isCollegeEmail(email)) {
      showAlert('registerAlert', '❌ Students must register with college email (e.g., yourname@bvmengineering.ac.in)', 'error');
      return;
    }
  }

  // VALIDATION: Password strength
  if (password.length < 6) {
    showAlert('registerAlert', 'Password must be at least 6 characters', 'error');
    return;
  }

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    const uid = cred.user.uid;

    // Clean name to remove any role suffixes before storing
    const cleanName = cleanUserName(name);

    let userData = {
      email, 
      role, 
      name: cleanName, // Store cleaned name
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
    showAlert('registerAlert', '✅ Registered! Please login.', 'success');
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

  if (role === 'student' && !isCollegeEmail(email)) {
    showAlert('loginAlert', '❌ Students must login with college email', 'error');
    return;
  }

  try {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    const uid = cred.user.uid;

    const userDoc = await db.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      await auth.signOut();
      showAlert('loginAlert', 'Account data not found', 'error');
      return;
    }

    const userData = userDoc.data();

    // ❌ ROLE MISMATCH
    if (userData.role !== role) {
      await auth.signOut();
      showAlert('loginAlert', 'Wrong role selected', 'error');
      return;
    }

    // 🚨 BLOCK ALUMNI UNTIL APPROVED
    if (role === 'alumni' && userData.verified === false) {
      await auth.signOut();
      showAlert(
        'loginAlert',
        '⏳ Your account is waiting for admin approval. Please try later.',
        'warning'
      );
      return;
    }

    // ✅ ALLOWED LOGIN
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
  if (activeChatRef) {
  activeChatRef.off();
  activeChatRef = null;
}

}

// Auth State Listener
// Around Line 140 in app.js
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

    const userData = userDoc.data();
    // Ensure required fields exist with defaults and clean name
    currentUser = { 
      uid: user.uid, 
      email: userData.email || '',
      role: userData.role || 'student',
      name: cleanUserName(userData.name || ''), // Clean name on load
      verified: userData.verified !== undefined ? userData.verified : (userData.role === 'student'),
      ...userData 
    };
    // Override name with cleaned version
    currentUser.name = cleanUserName(currentUser.name || '');
    currentRole = currentUser.role;

    // 🚨 SAFETY CHECK — BLOCK UNVERIFIED ALUMNI
    if (currentRole === 'alumni' && currentUser.verified === false) {
      await auth.signOut();

      document.getElementById('authSection').classList.remove('hidden');
      document.getElementById('mainContent').classList.add('hidden');

      showAlert(
        'loginAlert',
        '⏳ Your account is waiting for admin approval.',
        'warning'
      );
      return;
    }

    // ✅ ONLY APPROVED USERS REACH HERE
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('mainContent').classList.remove('hidden');

    updateUI();
    loadFeed();

    // Load chat recipients list (students see alumni, alumni see students)
    if (currentRole === 'student' || currentRole === 'alumni') {
      loadChatAlumni();
    }

    setupPresence();

  } catch (error) {
    console.error('Permission error during initial load:', error);
  }
});


// ==========================================
// UI FUNCTIONS
// ==========================================

function updateUI() {
  document.getElementById('userDisplay').textContent = `${currentUser.name} (${currentRole})`;
  updateSidebar();
}

// Replace the updateSidebar function in app.js
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
  addMenuItem('💬 Chat', 'chatView'); // Now visible to Student, Alumni, and Admin

  if (currentRole === 'alumni') {
    addMenuItem('✍️ Create Post', 'createPostView');
    addMenuItem('👤 My Profile', 'profileView');
    addMenuItem('🎯 Office Hours', 'rouletteView');
  }

  if (currentRole === 'student') {
    addMenuItem('🎯 Office Hours', 'rouletteView');
  }

  if (currentRole === 'admin') {
    addMenuItem('👑 Admin', 'adminView');
  }

  
}

function showView(viewId) {
  document.querySelectorAll('.view-page').forEach(v => v.style.display = 'none');
  document.getElementById(viewId).style.display = 'block';

  if (viewId === 'feedView') loadFeed();
  if (viewId === 'profileView') loadProfile();
  if (viewId === 'adminView') loadAdmin();
  
  // Show/hide roulette sections based on role
  if (viewId === 'rouletteView') {
    const alumniRoulette = document.getElementById('alumniRoulette');
    const studentRoulette = document.getElementById('studentRoulette');
    if (alumniRoulette) alumniRoulette.style.display = (currentRole === 'alumni') ? 'block' : 'none';
    if (studentRoulette) studentRoulette.style.display = (currentRole === 'student') ? 'block' : 'none';
  }
  
  // Initialize chat view
  if (viewId === 'chatView') {
    // If in private mode and no recipient selected, show placeholder
    if (currentChatMode === 'private' && !currentChatWith) {
      const messagesEl = document.getElementById('chatMessages');
      const chatInput = document.getElementById('chatInput');
      const btnSendMessage = document.getElementById('btnSendMessage');
      if (messagesEl) {
        messagesEl.innerHTML = '<p style="text-align:center; color:#999; padding:20px;">Select a recipient to start chatting</p>';
      }
      if (chatInput) chatInput.disabled = true;
      if (btnSendMessage) btnSendMessage.disabled = true;
    } else if (currentChatWith) {
      // Reload messages if we have a chat session
      const chatInput = document.getElementById('chatInput');
      const btnSendMessage = document.getElementById('btnSendMessage');
      if (chatInput) chatInput.disabled = false;
      if (btnSendMessage) btnSendMessage.disabled = false;
      loadChatMessages();
    } else if (currentChatMode === 'group') {
      // Auto-load group chat
      currentChatWith = { id: 'global_group', name: 'Global Community' };
      const chatInput = document.getElementById('chatInput');
      const btnSendMessage = document.getElementById('btnSendMessage');
      if (chatInput) chatInput.disabled = false;
      if (btnSendMessage) btnSendMessage.disabled = false;
      loadChatMessages();
    }
  }
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
      // STUDENTS: Show approved posts only
      const snapshot = await db.collection('posts')
        .where('approved', '==', true)
        .orderBy('createdAt', 'desc')
        .get();

      container.innerHTML = '';
      if (snapshot.empty) {
        container.innerHTML = '<p style="text-align:center; color:#999;">No approved posts yet</p>';
        return;
      }

      // Use Promise.all to properly await all async operations
      const postPromises = snapshot.docs.map(async doc => {
        const post = doc.data();
        const authorDoc = await db.collection('users').doc(post.authorId).get();
        const author = authorDoc.data();

        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
  <h3>${post.title}</h3>
  <p>${post.description}</p>
  ${post.authorId === currentUser.uid 
    ? `<button class="btn btn-danger" onclick="deletePost('${doc.id}')">Delete My Post</button>` 
    : `<button class="btn btn-primary" onclick="startChat('${post.authorId}', '${author.name}')">Chat with Author</button>`
  }
`;
        return card;
      });
      
      const cards = await Promise.all(postPromises);
      cards.forEach(card => container.appendChild(card));
      

         } else if (currentRole === 'alumni') {
      // ALUMNI: See ALL published posts (all auto-approved now)
      const snapshot = await db.collection('posts').orderBy('createdAt', 'desc').get();

      container.innerHTML = '';
      let hasAnyPosts = false;

      // Use Promise.all to properly await all async operations
      const postPromises = snapshot.docs.map(async doc => {
        const post = doc.data();
        const authorDoc = await db.collection('users').doc(post.authorId).get();
        const author = authorDoc.data();
        
        const card = document.createElement('div');
        card.className = 'card';
        
        card.innerHTML = `
          <h3>${post.title}</h3>
          <p style="color:#666; font-size:12px;">
            ${post.type.toUpperCase()} | By <strong>${author.name}</strong>
          </p>
          <p>${post.description}</p>
          ${post.authorId === currentUser.uid ? `<button class="btn btn-danger" onclick="deletePost('${doc.id}')">Delete My Post</button>` : `<button class="btn btn-primary" onclick="startChat('${post.authorId}', '${author.name}')">Chat with ${author.name}</button>`}
        `;
        return card;
      });
      
      const cards = await Promise.all(postPromises);
      if (cards.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#999;">No posts yet. Create one!</p>';
      } else {
        cards.forEach(card => container.appendChild(card));
      }


    } else if (currentRole === 'admin') {
      // ADMIN: See ALL posts (approved + pending)
      const snapshot = await db.collection('posts').orderBy('createdAt', 'desc').get();

      container.innerHTML = '';
      if (snapshot.empty) {
        container.innerHTML = '<p style="text-align:center; color:#999;">No posts yet</p>';
        return;
      }

      // Use Promise.all to properly await all async operations
      const postPromises = snapshot.docs.map(async doc => {
        const post = doc.data();
        const authorDoc = await db.collection('users').doc(post.authorId).get();
        const author = authorDoc.data();

        const card = document.createElement('div');
        card.className = 'card';
        const statusBadge = post.approved ? '✓ Approved' : '⏳ Pending Review';
        const statusColor = post.approved ? '#10b981' : '#f59e0b';

        card.innerHTML = `
          <h3>${post.title}</h3>
          <p style="color:#666; font-size:12px;">
            By <strong>${author.name}</strong> | ${post.type.toUpperCase()} | 
            <span style="color:${statusColor}; font-weight:bold;">${statusBadge}</span>
          </p>
          <p>${post.description}</p>
          ${!post.approved ? `<button class="btn btn-primary" onclick="approvePost('${doc.id}')">Approve</button>` : ''}
          <button class="btn btn-danger" onclick="rejectPost('${doc.id}')">Reject</button>
        `;
        return card;
      });
      
      const cards = await Promise.all(postPromises);
      cards.forEach(card => container.appendChild(card));
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
      approved: true,
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
  // Clean name to remove any role suffixes
  const cleanName = cleanUserName(user.name || '');
  document.getElementById('profName').value = cleanName;
  document.getElementById('profJobTitle').value = user.jobTitle || '';
  document.getElementById('profCompany').value = user.company || '';
  // Filter out empty strings from arrays
  document.getElementById('profSkills').value = (user.skills || []).filter(s => s && s.trim()).join(', ');
  document.getElementById('profInterests').value = (user.interests || []).filter(i => i && i.trim()).join(', ');
}

document.getElementById('btnSaveProfile').addEventListener('click', async () => {
  try {
    const name = document.getElementById('profName').value.trim();
    const jobTitle = document.getElementById('profJobTitle').value.trim();
    const company = document.getElementById('profCompany').value.trim();
    const skills = document.getElementById('profSkills').value.split(',').map(s => s.trim()).filter(Boolean);
    const interests = document.getElementById('profInterests').value.split(',').map(i => i.trim()).filter(Boolean);
    
    // Clean name before saving to ensure no role suffixes
    const cleanName = cleanUserName(name);
    
    await db.collection('users').doc(currentUser.uid).update({
      name: cleanName,
      jobTitle: jobTitle || null, // Store null instead of empty string
      company: company || null,
      skills: skills.length > 0 ? skills : [], // Ensure array, not null
      interests: interests.length > 0 ? interests : []
    });
    showAlert('profileAlert', 'Profile updated!', 'success');
    // Update local state with cleaned name
    currentUser.name = cleanName;
    currentUser.jobTitle = jobTitle;
    currentUser.company = company;
  } catch (error) {
    showAlert('profileAlert', error.message, 'error');
  }
});

// ==========================================
// CHAT FUNCTIONS
// ==========================================

// ==========================================
// CHAT FUNCTIONS
// ==========================================


let currentChatMode = 'private'; // 'private' or 'group'

function switchChatMode(mode) {
  // Disconnect previous listeners BEFORE changing mode
  if (currentChatWith && currentUser) {
    const oldPath = (currentChatMode === 'private') 
      ? `messages/private/${[currentUser.uid, currentChatWith.id].sort().join('_')}`
      : `messages/public/global_group`;
    rtdb.ref(oldPath).off();
  }
  
  currentChatMode = mode;
  
  // UI Toggles
  const btnPrivateTab = document.getElementById('btnPrivateTab');
  const btnGroupTab = document.getElementById('btnGroupTab');
  const privateChatControls = document.getElementById('privateChatControls');
  
  if (btnPrivateTab) btnPrivateTab.classList.toggle('active', mode === 'private');
  if (btnGroupTab) btnGroupTab.classList.toggle('active', mode === 'group');
  if (privateChatControls) privateChatControls.style.display = (mode === 'private') ? 'block' : 'none';
  
  // Reset and Load
  const messagesEl = document.getElementById('chatMessages');
  if (messagesEl) messagesEl.innerHTML = '';
  
  if (mode === 'group') {
    currentChatWith = { id: 'global_group', name: 'Global Community' };
    const chatInput = document.getElementById('chatInput');
    const btnSendMessage = document.getElementById('btnSendMessage');
    if (chatInput) chatInput.disabled = false;
    if (btnSendMessage) btnSendMessage.disabled = false;
    loadChatMessages();
  } else {
    // For private mode, check if there's a selected recipient
    const select = document.getElementById('chatSelect');
    if (select && select.value) {
      const recipientName = select.options[select.selectedIndex].text;
      startChat(select.value, recipientName);
    } else {
      currentChatWith = null;
      const chatInput = document.getElementById('chatInput');
      const btnSendMessage = document.getElementById('btnSendMessage');
      if (chatInput) chatInput.disabled = true;
      if (btnSendMessage) btnSendMessage.disabled = true;
      if (messagesEl) {
        messagesEl.innerHTML = '<p style="text-align:center; color:#999; padding:20px;">Select a recipient to start chatting</p>';
      }
    }
  }
}

async function startChat(recipientId, recipientName) {
  currentChatWith = { id: recipientId, name: recipientName };
  currentChatMode = 'private'; // Ensure we're in private mode
  
  // Update UI
  const btnPrivateTab = document.getElementById('btnPrivateTab');
  const btnGroupTab = document.getElementById('btnGroupTab');
  if (btnPrivateTab) btnPrivateTab.classList.add('active');
  if (btnGroupTab) btnGroupTab.classList.remove('active');
  
  // Enable input and send button
  const chatInput = document.getElementById('chatInput');
  const btnSendMessage = document.getElementById('btnSendMessage');
  if (chatInput) chatInput.disabled = false;
  if (btnSendMessage) btnSendMessage.disabled = false;
  
  showView('chatView');
  loadChatMessages();
}

async function loadChatMessages() {
  if (!currentChatWith || !currentUser) {
    const messagesEl = document.getElementById('chatMessages');
    if (messagesEl) {
      messagesEl.innerHTML =
        '<p style="text-align:center; color:#999; padding:20px;">Select a recipient to start chatting</p>';
    }
    return;
  }

  // Determine chat path
  const chatPath =
    currentChatMode === 'private'
      ? `messages/private/${[currentUser.uid, currentChatWith.id].sort().join('_')}`
      : `messages/public/global_group`;

  const messagesEl = document.getElementById('chatMessages');
  if (!messagesEl) return;

  // 🔥 DETACH PREVIOUS LISTENER (CRITICAL FIX)
  if (activeChatRef) {
    activeChatRef.off();
    activeChatRef = null;
  }

  // 🔥 CREATE NEW REF AND STORE IT
  activeChatRef = rtdb.ref(chatPath);

  // Clear UI and show loading
  messagesEl.innerHTML =
    '<p style="text-align:center; color:#999; padding:20px;">Loading messages...</p>';

  try {
    // 🔹 Load existing messages ONCE
    const snapshot = await activeChatRef.limitToLast(50).once('value');
    messagesEl.innerHTML = '';

    if (snapshot.exists()) {
      const messages = [];

      snapshot.forEach(child => {
        messages.push({ key: child.key, ...child.val() });
      });

      // Sort messages by timestamp
      messages.sort((a, b) => (a.time || 0) - (b.time || 0));

      messages.forEach(msg => {
        renderMessage(msg, messagesEl);
      });

      messagesEl.scrollTop = messagesEl.scrollHeight;
    } else {
      messagesEl.innerHTML =
        '<p style="text-align:center; color:#999; padding:20px;">No messages yet. Start the conversation!</p>';
    }
  } catch (error) {
    console.error('Error loading messages:', error);
    messagesEl.innerHTML =
      `<p style="text-align:center; color:red; padding:20px;">${error.message}</p>`;
  }

  // 🔥 ATTACH REAL-TIME LISTENER (ONLY ONCE)
  activeChatRef.limitToLast(50).on('child_added', snap => {
    const messagesEl = document.getElementById('chatMessages');
    if (!messagesEl) return;

    // Prevent duplicates
    if (messagesEl.querySelector(`[data-msg-key="${snap.key}"]`)) return;

    const msg = { key: snap.key, ...snap.val() };
    renderMessage(msg, messagesEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });
}
function renderMessage(msg, messagesEl) {
  const div = document.createElement('div');
  div.className =
    msg.senderId === currentUser.uid ? 'msg-sent' : 'msg-received';

  div.setAttribute('data-msg-key', msg.key);

  const cleanSenderName = cleanUserName(msg.senderName || 'Unknown');

  const senderLabel =
    currentChatMode === 'group' && msg.senderId !== currentUser.uid
      ? `<span class="msg-sender-name">${cleanSenderName}</span>`
      : '';

  div.innerHTML = `
    ${senderLabel}
    <p>${msg.text || ''}</p>
    <span class="msg-time">
      ${msg.time
        ? new Date(msg.time).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          })
        : ''}
    </span>
  `;

  messagesEl.appendChild(div);
}


// Send message function
async function sendMessage() {
  if (!currentUser || !currentChatWith) {
    alert('Please select a recipient first');
    return;
  }
  
  const chatInput = document.getElementById('chatInput');
  const text = chatInput.value.trim();
  
  if (!text) return;

  const chatPath = (currentChatMode === 'private') 
    ? `messages/private/${[currentUser.uid, currentChatWith.id].sort().join('_')}`
    : `messages/public/global_group`;

  try {
    await rtdb.ref(chatPath).push({
      senderId: currentUser.uid,
      senderName: cleanUserName(currentUser.name), // Clean name before storing
      text,
      time: Date.now()
    });

    chatInput.value = '';
  } catch (error) {
    console.error('Error sending message:', error);
    alert('Failed to send message: ' + error.message);
  }
}

// Set up send message button
document.getElementById('btnSendMessage').addEventListener('click', sendMessage);

// Add Enter key support for sending messages
document.getElementById('chatInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Helper function to clean name by removing role suffixes
function cleanUserName(name) {
  if (!name) return name;
  // Remove common role suffixes: (student), (alumni), (admin), etc.
  return name.replace(/\s*\(student\)/gi, '')
              .replace(/\s*\(alumni\)/gi, '')
              .replace(/\s*\(admin\)/gi, '')
              .trim();
}

// Load chat recipients list (students see alumni, alumni see students)
async function loadChatAlumni() {
  const select = document.getElementById('chatSelect');
  if (!select) return;

  // 🔥 STOP previous listener
  if (chatUsersUnsubscribe) {
    chatUsersUnsubscribe();
    chatUsersUnsubscribe = null;
  }

  // 🔥 CLEAR dropdown fully
  select.innerHTML = '';

  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent =
    currentRole === 'student'
      ? 'Select Alumni...'
      : 'Select Student...';

  select.appendChild(defaultOption);

  // 🔐 STRICT role-based query
  let query;

  if (currentRole === 'student') {
    query = db.collection('users')
      .where('role', '==', 'alumni')
      .where('verified', '==', true);
  } else if (currentRole === 'alumni') {
    query = db.collection('users')
      .where('role', '==', 'student');
  } else {
    return; // admin shouldn't load chat list
  }

  // 🔥 SINGLE snapshot listener
  chatUsersUnsubscribe = query.onSnapshot(snapshot => {
    select.innerHTML = '';
    select.appendChild(defaultOption);

    snapshot.forEach(doc => {
      if (doc.id === currentUser.uid) return;

      const user = doc.data();

      const option = document.createElement('option');
      option.value = doc.id;
      option.textContent = cleanUserName(user.name);

      select.appendChild(option);
    });
  });
}

// ==========================================
// OFFICE HOURS ROULETTE
// ==========================================
// ==========================================
// OFFICE HOURS ROULETTE (NO-API VERSION)
// ==========================================

let queueListener = null; // To store the real-time listener

// --- ALUMNI FUNCTIONS ---

document.getElementById('btnUpdateLive').addEventListener('click', async () => {
  const isLive = document.getElementById('alumniLiveToggle').checked;
  const meetLink = document.getElementById('alumniMeetLink').value.trim();

  // Validation: Must have a link to go live
  if (isLive && !meetLink) {
    alert("❌ Please paste your Google Meet link first!");
    document.getElementById('alumniLiveToggle').checked = false;
    return;
  }

  try {
    // 1. Update User Status
    await db.collection('users').doc(currentUser.uid).update({
      isLive: isLive,
      meetLink: meetLink || "" // Save the link so we can give it to students later
    });

    if (isLive) {
      alert('✅ You are now LIVE! Students can see you.');
      listenToMyQueue(); // Start watching for students
    } else {
      alert('You are offline.');
      if (queueListener) queueListener(); // Stop listening
      document.getElementById('alumniQueueContainer').innerHTML = '<p style="color:#999; text-align:center;">You are offline.</p>';
    }

  } catch (error) {
    console.error(error);
    alert('Error updating status: ' + error.message);
  }
});

// Real-time listener for the Alumni to see waiting students
function listenToMyQueue() {
  const container = document.getElementById('alumniQueueContainer');
  
  // Listen to the sub-collection 'queue' under this alumni
  queueListener = db.collection('users').doc(currentUser.uid).collection('queue')
    .where('status', '==', 'waiting') // Only show waiting students
    .orderBy('timestamp', 'asc')
    .onSnapshot(snapshot => {
      container.innerHTML = '';
      
      if (snapshot.empty) {
        container.innerHTML = '<p style="color:#999; text-align:center;">No students waiting yet.</p>';
        return;
      }

      snapshot.forEach(doc => {
        const req = doc.data();
        const card = document.createElement('div');
        card.className = 'card';
        card.style.background = '#f8f9fa';
        card.style.marginBottom = '10px';
        card.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <h4 style="margin:0;">${req.studentName}</h4>
              <p style="margin:5px 0 0 0; font-size:13px; color:#555;">Topic: <strong>${req.question}</strong></p>
            </div>
            <button class="btn btn-primary btn-sm" onclick="admitStudent('${doc.id}')">Admit</button>
          </div>
        `;
        container.appendChild(card);
      });
    });
}

// Alumni clicks "Admit" -> Updates status -> Student gets link
async function admitStudent(studentId) {
  try {
    await db.collection('users').doc(currentUser.uid).collection('queue').doc(studentId).update({
      status: 'admitted'
    });
    // Optional: Remove from UI immediately or let the snapshot listener handle it
  } catch (error) {
    alert("Error admitting student: " + error.message);
  }
}

// --- STUDENT FUNCTIONS ---

document.getElementById('btnFindAlumni').addEventListener('click', async () => {
  const question = document.getElementById('studentQuestion').value.trim();
  if (!question) {
    alert("Please enter a topic/question first!");
    return;
  }

  const btn = document.getElementById('btnFindAlumni');
  btn.disabled = true;
  btn.textContent = "Searching...";

  try {
    // 1. Find ANY alumni who is live
    const snapshot = await db.collection('users')
      .where('role', '==', 'alumni')
      .where('isLive', '==', true)
      .limit(1) // Get just one for now (Roulette style)
      .get();

    if (snapshot.empty) {
      alert("No alumni are live right now. Try again later!");
      btn.disabled = false;
      btn.textContent = "Find Live Alumni";
      return;
    }

    // 2. Pick the alumni
    const alumniDoc = snapshot.docs[0];
    const alumniId = alumniDoc.id;
    const alumniData = alumniDoc.data();

    // 3. Create a Queue Request
    await db.collection('users').doc(alumniId).collection('queue').doc(currentUser.uid).set({
      studentName: currentUser.name,
      studentId: currentUser.uid,
      question: question,
      status: 'waiting',
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    // 4. Switch UI to Waiting Room
    document.getElementById('studentSearchArea').style.display = 'none';
    document.getElementById('studentWaitingRoom').style.display = 'block';
    document.getElementById('waitingText').innerHTML = `Waiting for <strong>${alumniData.name}</strong> to let you in...`;

    // 5. Start listening for acceptance
    listenForAdmission(alumniId);

  } catch (error) {
    console.error(error);
    alert("Error: " + error.message);
    btn.disabled = false;
    btn.textContent = "Find Live Alumni";
  }
});

function listenForAdmission(alumniId) {
  const unsubscribe = db.collection('users').doc(alumniId).collection('queue').doc(currentUser.uid)
    .onSnapshot(async (doc) => {
      if (!doc.exists) return;
      
      const data = doc.data();
      
      // 🎉 ADMITTED!
      if (data.status === 'admitted') {
        // Fetch the alumni's link again to be sure
        const alumniUser = await db.collection('users').doc(alumniId).get();
        const meetLink = alumniUser.data().meetLink;

        // Show the JOIN button
        const ticketDiv = document.getElementById('admissionTicket');
        ticketDiv.innerHTML = `
          <div class="alert alert-success">
            <strong>✅ You are approved!</strong>
          </div>
          <a href="${meetLink}" target="_blank" class="btn btn-primary full-width" style="text-decoration:none; display:block; text-align:center;">
            📹 JOIN VIDEO CALL NOW
          </a>
        `;
        
        // Stop spinner
        document.querySelector('.spinner').style.display = 'none';
        document.getElementById('waitingText').style.display = 'none';
        
        // Stop listening (optional, but good practice)
        unsubscribe();
      }
    });
}

async function cancelRequest() {
  // Reset UI
  document.getElementById('studentSearchArea').style.display = 'block';
  document.getElementById('studentWaitingRoom').style.display = 'none';
  document.getElementById('btnFindAlumni').disabled = false;
  document.getElementById('btnFindAlumni').textContent = "Find Live Alumni";
  document.getElementById('admissionTicket').innerHTML = '';
  document.querySelector('.spinner').style.display = 'block';
  // Note: ideally we would delete the doc from Firestore here too, but for hackathon this is fine.
}

// ==========================================
// ADMIN FUNCTIONS
// ==========================================

async function loadAdmin() {
  const pendingAlumniDiv = document.getElementById('pendingAlumniList');
  const allPostsDiv = document.getElementById('pendingPostsList');

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
          <button class="btn btn-primary" onclick="approveAlumni('${doc.id}')">Verify Alumni</button>
          <button class="btn btn-danger" onclick="rejectAlumni('${doc.id}')">Reject</button>
        `;
        pendingAlumniDiv.appendChild(div);
      });
    }

    // NOW SHOWING ALL POSTS (for admin to reject irrelevant ones)
    const postsSnapshot = await db.collection('posts')
      .orderBy('createdAt', 'desc')
      .get();

    allPostsDiv.innerHTML = '';
    if (postsSnapshot.empty) {
      allPostsDiv.innerHTML = '<p style="color:#999;">No posts</p>';
    } else {
      // Use Promise.all to properly await all async operations
      const postPromises = postsSnapshot.docs.map(async doc => {
        const post = doc.data();
        const authorDoc = await db.collection('users').doc(post.authorId).get();
        const author = authorDoc.data();
        
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
          <h4>${post.title}</h4>
          <p style="color:#666; font-size:12px;">By <strong>${author.name}</strong> | ${post.type.toUpperCase()}</p>
          <p>${post.description}</p>
          <button class="btn btn-danger" onclick="rejectPost('${doc.id}')">❌ Delete (Irrelevant)</button>
        `;
        return div;
      });
      
      const divs = await Promise.all(postPromises);
      divs.forEach(div => allPostsDiv.appendChild(div));
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

// Note: setupPresence() and loadChatAlumni() are now called in auth.onAuthStateChanged
// after user authentication is confirmed, so we don't need to call them here
// ==========================================
// EMAIL VALIDATION FUNCTION
// ==========================================

function isCollegeEmail(email) {
  // List of accepted college email domains
  const collegeEmailDomains = [
    '@bvmengineering.ac.in',
    '@bvm.ac.in',
    '@bvmieu.ac.in',
    '@bvmhs.ac.in'
    // Add more college domains as needed
  ];

  // Check if email ends with any of the college domains
  return collegeEmailDomains.some(domain => email.toLowerCase().endsWith(domain));
}