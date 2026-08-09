import React, { useState, useContext, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, TextInput, KeyboardAvoidingView, Platform, Modal, ImageBackground, Linking, Animated } from 'react-native';
import { AppContext } from './AppContext';
import firebase from 'firebase';
import { db, auth, storage } from './FirebaseConfig';
import { styles } from './styles';
import * as ImagePicker from 'expo-image-picker';

export default function ClientScreens() {
  const ctx = useContext(AppContext);
  const { currentScreen, setCurrentScreen, user, userData, setUserData, leaderboard, matchesList, newsList, rssNews, forumCategories, allThreads, songsList, awayInfoList, usersList, formatDanishDate, getTeamLogo, getTeamStyle, getStadium, setMenuOpen, menuOpen, handleManualRefresh, nextMatch, upcomingMatchesToDisplay, isMatchLocked, logActivity, showAlert } = ctx;

  const [selectedNews, setSelectedNews] = useState(null);
  const [newsComments, setNewsComments] = useState([]);
  const [newNewsComment, setNewNewsComment] = useState('');
  
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedThread, setSelectedThread] = useState(null);
  const [threadReplies, setThreadReplies] = useState([]);
  const [newThreadTitle, setNewThreadTitle] = useState('');
  const [newThreadContent, setNewThreadContent] = useState('');
  const [newReplyContent, setNewReplyContent] = useState('');

  const [selectedSong, setSelectedSong] = useState(null);
  const [showSongForm, setShowSongForm] = useState(false);
  const [selectedAwayInfo, setSelectedAwayInfo] = useState(null);

  const [newSongTitle, setNewSongTitle] = useState('');
  const [newSongLyrics, setNewSongLyrics] = useState('');
  const [newSongLink, setNewSongLink] = useState('');
  const [newSongMelody, setNewSongMelody] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [username, setUsername] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');
  const [signature, setSignature] = useState('');
  const [hideFractions, setHideFractions] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Notifikationsindstillinger state
  const [notifNews, setNotifNews] = useState(userData?.notifPreferences?.news ?? true);
  const [notifAway, setNotifAway] = useState(userData?.notifPreferences?.away ?? true);
  const [notifTipspil, setNotifTipspil] = useState(userData?.notifPreferences?.tipspil ?? true);
  const [notifForum, setNotifForum] = useState(userData?.notifPreferences?.forum ?? true);

  // Notifikationsbar rotation og dropdown state
  const [currentNotifIndex, setCurrentNotifIndex] = useState(0);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  // Animationer for pulserende LIVE tekst og smooth notifikations-fade
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const notifAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true })
      ])
    ).start();
  }, [pulseAnim]);

  const [selectedRound, setSelectedRound] = useState('Runde 1');
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showGuessesModal, setShowGuessesModal] = useState(false);
  const [selectedMatchForGuesses, setSelectedMatchForGuesses] = useState(null);
  const [matchGuessesList, setMatchGuessesList] = useState([]);
  const [isLoadingGuesses, setIsLoadingGuesses] = useState(false);
  const [showAdvancedLb, setShowAdvancedLb] = useState(false);

  // Computed data
  const isSuperAdmin = (user && user.email === 'schaldeab@gmail.com') || (userData && userData.role === 'Super Admin');
  const isAdmin = isSuperAdmin || (userData && userData.role === 'Admin');
  const isEditor = isAdmin || (userData && userData.role === 'Redaktør');
  const canViewAwayInfo = isSuperAdmin || isAdmin || isEditor || (userData && userData.role === 'Verificeret AB Fan');
  
  const blockedUsers = userData?.blockedUsers || [];
  const visibleThreads = allThreads.filter(t => !blockedUsers.includes(t.authorId));
  const visibleReplies = threadReplies.filter(r => !blockedUsers.includes(r.authorId));
  const visibleNewsComments = newsComments.filter(c => !blockedUsers.includes(c.authorId));

  const activeLeaderboard = leaderboard.filter(u => (u.points || 0) > 0);
  const lastFinishedRoundName = [...matchesList].reverse().filter(m => m.finalScore && m.tournament !== 'Betano Pokalen')[0]?.round || null;
  const lastRoundTopTipsters = lastFinishedRoundName ? [...activeLeaderboard].sort((a, b) => (b.roundPoints?.[lastFinishedRoundName] || 0) - (a.roundPoints?.[lastFinishedRoundName] || 0)).slice(0, 3) : [];

  const pendingResultsCount = matchesList.filter(m => m.matchDate && new Date(m.matchDate.replace(' ', 'T')).getTime() < new Date().getTime() && m.finalScore === false).length;
  const pendingSongsCount = ctx.pendingSongs?.length || 0;
  const adminNotificationsCount = pendingSongsCount + pendingResultsCount;

  // Live match tjek (110 minutter efter kampstart)
  const isMatchLive = (matchDateStr) => {
    if (!matchDateStr) return false;
    const start = new Date(matchDateStr.replace(' ', 'T')).getTime();
    const now = new Date().getTime();
    const end = start + (110 * 60 * 1000);
    return now >= start && now <= end;
  };

  // Live avatar hjælperfunktion
  const getLiveAuthorPhoto = (authorId, defaultPhoto) => {
    const foundUser = usersList.find(u => u.id === authorId);
    return foundUser?.photoURL || defaultPhoto || 'https://via.placeholder.com/150';
  };

  // Notifikationer logik med øjeblikkelig optimstisk opdatering af state, så de forsvinder med det samme
  const getNotifications = () => {
    if (!user) return [];
    const prefs = userData?.notifPreferences || { news: true, away: true, tipspil: true, forum: true };
    let notifs = [];

    if (prefs.news && newsList.length > 0) {
      const seenNews = userData?.seenNewsIds || [];
      const unreadNews = newsList.filter(n => !seenNews.includes(n.id));
      if (unreadNews.length > 0) {
        const target = unreadNews[0];
        notifs.push({
          id: 'news_' + target.id,
          text: `📰 Nyhed: "${target.title}"`,
          onPress: () => {
            setShowNotifDropdown(false);
            const updatedSeenNews = [...seenNews, target.id];
            setUserData(prev => ({ ...prev, seenNewsIds: updatedSeenNews }));
            db.collection('users').doc(user.uid).set({
              seenNewsIds: firebase.firestore.FieldValue.arrayUnion(target.id)
            }, { merge: true }).catch(()=>{});
            setSelectedNews(target);
            setCurrentScreen('newsDetail');
          }
        });
      }
    }

    if (prefs.away && canViewAwayInfo && awayInfoList.length > 0) {
      const seenAway = userData?.seenAwayIds || [];
      const unreadAway = awayInfoList.filter(a => !seenAway.includes(a.id));
      if (unreadAway.length > 0) {
        const target = unreadAway[0];
        notifs.push({
          id: 'away_' + target.id,
          text: `🚌 Ny away info: (${target.opponent || target.matchDetails?.homeTeam || 'Udebane'})`,
          onPress: () => {
            setShowNotifDropdown(false);
            const updatedSeenAway = [...seenAway, target.id];
            setUserData(prev => ({ ...prev, seenAwayIds: updatedSeenAway }));
            db.collection('users').doc(user.uid).set({
              seenAwayIds: firebase.firestore.FieldValue.arrayUnion(target.id)
            }, { merge: true }).catch(()=>{});
            setSelectedAwayInfo(target);
            setCurrentScreen('awayInfo');
          }
        });
      }
    }

    if (prefs.tipspil) {
      const lastSeenTipspil = userData?.lastSeenTipspil || 0;
      const finishedMatches = matchesList.filter(m => m.finalScore && (m.createdAt?.toMillis ? m.createdAt.toMillis() > lastSeenTipspil : true));
      if (finishedMatches.length > 0 && (userData?.points || 0) > 0) {
        notifs.push({
          id: 'tipspil_pts',
          text: `⚽ Tipspil opdateret med nye point!`,
          onPress: () => {
            setShowNotifDropdown(false);
            const nowTime = Date.now();
            setUserData(prev => ({ ...prev, lastSeenTipspil: nowTime }));
            db.collection('users').doc(user.uid).set({
              lastSeenTipspil: nowTime
            }, { merge: true }).catch(()=>{});
            setCurrentScreen('tipspil');
          }
        });
      }
    }

    if (prefs.forum) {
      const seenThreads = userData?.seenForumThreadIds || [];
      const myThreadIds = allThreads.filter(t => t.authorId === user.uid).map(t => t.id);
      const unreadThreads = allThreads.filter(t => myThreadIds.includes(t.id) && !seenThreads.includes(t.id));
      if (unreadThreads.length > 0) {
        const target = unreadThreads[0];
        notifs.push({
          id: 'forum_' + target.id,
          text: `💬 Nyt svar i din debat: "${target.title}"`,
          onPress: () => {
            setShowNotifDropdown(false);
            const updatedSeenThreads = [...seenThreads, target.id];
            setUserData(prev => ({ ...prev, seenForumThreadIds: updatedSeenThreads }));
            db.collection('users').doc(user.uid).set({
              seenForumThreadIds: firebase.firestore.FieldValue.arrayUnion(target.id)
            }, { merge: true }).catch(()=>{});
            setSelectedCategory(forumCategories.find(c => c.id === target.categoryId) || forumCategories[0]);
            setSelectedThread(target);
            setCurrentScreen('forum');
          }
        });
      }
    }

    return notifs;
  };
  const activeNotifications = getNotifications();

  // Automatisk rotation af notifikationer hvert 10. sekund med smooth fade
  useEffect(() => {
    if (activeNotifications.length <= 1) return;
    const timer = setInterval(() => {
      Animated.timing(notifAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
        setCurrentNotifIndex(prev => (prev + 1) % activeNotifications.length);
        Animated.timing(notifAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      });
    }, 10000);
    return () => clearInterval(timer);
  }, [activeNotifications.length, notifAnim]);

  const canAccessCategory = (cat) => {
    if (isAdmin || isEditor || isSuperAdmin) return true;
    const allowed = cat.allowedRoles;
    if (!allowed || allowed.length === 0) return true;
    return allowed.includes(userData?.role || 'Alm. Bruger');
  };

  const formatShortDateWithTime = (dateInput) => {
    if (!dateInput) return ''; let d;
    if (dateInput.toDate) d = dateInput.toDate();
    else if (typeof dateInput === 'string') { const isMatchFormat = dateInput.includes(' ') && !dateInput.includes('T'); d = new Date(isMatchFormat ? dateInput.replace(' ', 'T') : dateInput); }
    else d = new Date(dateInput);
    if (isNaN(d.getTime())) return dateInput;
    const days = ['Søn.', 'Man.', 'Tir.', 'Ons.', 'Tor.', 'Fre.', 'Lør.']; 
    const months = ['jan.', 'feb.', 'mar.', 'apr.', 'maj', 'jun.', 'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'dec.'];
    return `${days[d.getDay()]} ${d.getDate()}. ${months[d.getMonth()]} kl. ${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (currentScreen === 'tipspil' && matchesList.length > 0) {
      const unplayedMatches = matchesList.filter(m => !m.finalScore);
      unplayedMatches.sort((a, b) => {
         const timeA = a.matchDate ? new Date(a.matchDate.replace(' ', 'T')).getTime() : 0;
         const timeB = b.matchDate ? new Date(b.matchDate.replace(' ', 'T')).getTime() : 0;
         return timeA - timeB;
      });
      if (unplayedMatches.length > 0 && unplayedMatches[0].round) {
        setSelectedRound(unplayedMatches[0].round);
      }
    }
  }, [currentScreen, matchesList.length]);

  useEffect(() => {
    if (!selectedNews) return;
    const unsub = db.collection('news').doc(selectedNews.id).collection('comments').orderBy('createdAt', 'asc').onSnapshot((snap) => setNewsComments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    return unsub;
  }, [selectedNews]);

  useEffect(() => {
    if (!selectedThread) return;
    const unsub = db.collection('forum_threads').doc(selectedThread.id).collection('replies').orderBy('createdAt', 'asc').onSnapshot((snap) => setThreadReplies(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    return unsub;
  }, [selectedThread]);

  const handlePickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.5 });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      if (result.assets[0].fileSize && result.assets[0].fileSize > 2 * 1024 * 1024) return showAlert("Fejl", "Billedet må maksimalt være 2 MB.");
      setIsUploading(true);
      try {
        const response = await fetch(result.assets[0].uri); const blob = await response.blob();
        const ref = storage.ref().child(`avatars/${auth.currentUser ? auth.currentUser.uid : 'ny_bruger'}_${Date.now()}`);
        await ref.put(blob); setAvatarUrl(await ref.getDownloadURL()); showAlert("Succes", "Billede uploadet!");
      } catch (error) { showAlert("Fejl", error.message); } finally { setIsUploading(false); }
    }
  };

  const handleOpenProfile = async (userId) => { try { const doc = await db.collection('users').doc(userId).get(); if (doc.exists) ctx.setViewingProfileUser({id: doc.id, ...doc.data()}); } catch (e) {} };

  const handleBlockUser = async (targetUid, targetName) => {
    Alert.alert("Bloker bruger", `Er du sikker på, at du vil blokere ${targetName}?`, [
      {text: "Annuller", style: "cancel"},
      {text: "Bloker", style: "destructive", onPress: async () => {
        const newBlocked = [...blockedUsers, targetUid];
        await db.collection('users').doc(user.uid).update({ blockedUsers: newBlocked });
        setUserData({...userData, blockedUsers: newBlocked});
        showAlert("Blokeret", `${targetName} er blokeret.`);
      }}
    ]);
  };

  const handleReportContent = async (contentType, contentId, authorId, authorName) => {
    Alert.alert("Anmeld indhold", `Vil du anmelde dette indhold fra ${authorName}?`, [
      {text: "Annuller", style: "cancel"},
      {text: "Anmeld", style: "destructive", onPress: async () => {
        await db.collection('reports').add({ contentType, contentId, reportedAuthorId: authorId, reportedBy: user.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp(), status: 'pending' });
        showAlert("Anmeldt", "Indholdet er anmeldt til administratorerne.");
      }}
    ]);
  };

  const openUGCMenu = (contentType, contentId, authorId, authorName) => {
    if (!user) return showAlert("Log ind", "Log ind for at bruge denne funktion.");
    Alert.alert("Valgmuligheder", "Hvad vil du gøre?", [
      {text: "Anmeld indhold", onPress: () => handleReportContent(contentType, contentId, authorId, authorName)},
      {text: `Bloker ${authorName}`, onPress: () => handleBlockUser(authorId, authorName)},
      {text: "Annuller", style: "cancel"}
    ]);
  };

  const renderProfileModal = () => {
    let userRank = 'Ikke rangeret'; 
    if (ctx.viewingProfileUser) {
      const sortedLb = [...leaderboard].sort((a, b) => (b.points || 0) - (a.points || 0));
      const userRankIndex = sortedLb.findIndex(u => u.id === ctx.viewingProfileUser.id);
      if (userRankIndex !== -1) userRank = `${userRankIndex + 1}. plads`;
    }
    const viewUser = ctx.viewingProfileUser;
    const viewUserLivePhoto = viewUser ? getLiveAuthorPhoto(viewUser.id, viewUser.photoURL) : '';
    return (
      <Modal visible={viewUser !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {viewUser && (
              <>
                <Image source={{uri: viewUserLivePhoto}} style={{width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: '#C5A059', marginBottom: 10}} />
                <Text style={{fontSize: 20, fontWeight: '900', color: '#12352A', marginBottom: 2}}>{viewUser.username}</Text>
                <Text style={{fontSize: 12, color: '#C5A059', fontWeight: 'bold', marginBottom: 10}}>{viewUser.role || 'Alm. Bruger'}</Text>
                {!viewUser.hideFractions && viewUser.fractions?.length > 0 && (<Text style={{fontSize: 13, color: '#12352A', fontWeight: 'bold', fontStyle: 'italic', marginBottom: 10}}>{viewUser.fractions.join(', ')}</Text>)}
                <View style={{backgroundColor: '#12352A', padding: 12, borderRadius: 8, width: '100%', marginBottom: 15, borderWidth: 1, borderColor: '#C5A059'}}>
                  <Text style={{fontSize: 12, fontWeight: '900', color: '#C5A059', marginBottom: 8, textTransform: 'uppercase'}}>📊 Tipspil Statistik</Text>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6}}><Text style={{color: '#fff', fontSize: 12}}>Placering:</Text><Text style={{color: '#fff', fontWeight: 'bold', fontSize: 12}}>{userRank}</Text></View>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6}}><Text style={{color: '#fff', fontSize: 12}}>Samlede Point:</Text><Text style={{color: '#C5A059', fontWeight: 'bold', fontSize: 12}}>{viewUser.points || 0} pts</Text></View>
                </View>
                <TouchableOpacity style={[styles.primaryButton, {width: '100%'}]} onPress={() => ctx.setViewingProfileUser(null)}><Text style={styles.primaryButtonText}>LUK</Text></TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    );
  };

  const TopBarMenu = () => {
    const liveMyPhoto = user ? getLiveAuthorPhoto(user.uid, userData?.photoURL || user?.photoURL) : '';
    const safeNotifIndex = activeNotifications.length > 0 ? currentNotifIndex % activeNotifications.length : 0;
    return (
      <>
        <TouchableOpacity onPress={() => setCurrentScreen('home')} style={styles.headerBannerContainer} activeOpacity={0.9}>
          <Image source={{ uri: 'https://i.imgur.com/fpRHIje.png' }} style={styles.headerImageBanner} resizeMode="cover" />
        </TouchableOpacity>

        {/* Notifikationsbar med samlet antal, enkeltvis rullende notifikation og dropdown pil */}
        <View style={{backgroundColor: '#12352A', paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#C5A059'}}>
          <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
            <View style={{flex: 1}}>
              <Text style={{fontSize: 10, fontWeight: '900', color: '#C5A059', marginBottom: 2, textTransform: 'uppercase'}}>🔔 Notifikationer ({activeNotifications.length})</Text>
              {activeNotifications.length === 0 ? (
                <Text style={{fontSize: 11, color: '#fff', fontStyle: 'italic'}}>Ingen nye notifikationer</Text>
              ) : (
                <Animated.View style={{ opacity: notifAnim }}>
                  <TouchableOpacity onPress={activeNotifications[safeNotifIndex]?.onPress} style={{paddingVertical: 2}}>
                    <Text style={{fontSize: 12, color: '#C5A059', fontWeight: 'bold'}} numberOfLines={1}>
                      • {activeNotifications[safeNotifIndex]?.text} ➔
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              )}
            </View>
            {activeNotifications.length > 0 && (
              <TouchableOpacity onPress={() => setShowNotifDropdown(!showNotifDropdown)} style={{paddingLeft: 10, paddingVertical: 4}}>
                <Text style={{fontSize: 14, color: '#C5A059', fontWeight: 'bold'}}>{showNotifDropdown ? '▲' : '▼'}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Dropdown menu med alle notifikationer */}
          {showNotifDropdown && activeNotifications.length > 0 && (
            <View style={{marginTop: 8, borderTopWidth: 1, borderTopColor: '#C5A059', paddingTop: 6}}>
              {activeNotifications.map(n => (
                <TouchableOpacity key={n.id} onPress={n.onPress} style={{paddingVertical: 4}}>
                  <Text style={{fontSize: 12, color: '#fff'}} numberOfLines={1}>• {n.text} ➔</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.menuBar}>
          <TouchableOpacity onPress={() => setMenuOpen(!menuOpen)} style={styles.menuBarButton}><Text style={styles.menuBarText}>{menuOpen ? '✖ LUK MENU' : '☰ MENU'} {!menuOpen && adminNotificationsCount > 0 && isAdmin && <Text style={{color: '#E30613'}}> 🔴</Text>}</Text></TouchableOpacity>
          <TouchableOpacity onPress={handleManualRefresh} style={styles.refreshBarButton}><Text style={styles.refreshBarText}>🔄 GENINDLÆS</Text></TouchableOpacity>
        </View>
        {menuOpen && (
          <>
            <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuOpen(false)} />
            <View style={styles.sideMenu}>
              {user && (
                <View style={styles.profileHeader}>
                  <TouchableOpacity onPress={() => handleOpenProfile(user.uid)}><Image source={{ uri: liveMyPhoto }} style={styles.profileImage} /></TouchableOpacity>
                  <Text style={styles.profileName}>{userData?.username || user.displayName || 'AB Fan'}</Text>
                  <Text style={{color: '#C5A059', fontSize: 11, fontWeight: 'bold', marginBottom: 4}}>{isSuperAdmin ? 'Super Admin' : (userData?.role || 'Alm. Bruger')}</Text>
                  {!hideFractions && userData?.fractions?.length > 0 && (<Text style={{color: '#fff', fontSize: 11, fontWeight: 'bold', marginBottom: 8, fontStyle: 'italic'}}>{userData.fractions.join(', ')}</Text>)}
                  <TouchableOpacity style={styles.editProfileMenuBtn} onPress={() => { setUsername(userData?.username || ''); setAvatarUrl(userData?.photoURL || user?.photoURL || ''); setBio(userData?.bio || ''); setSignature(userData?.signature || ''); setCurrentScreen('editProfile'); setMenuOpen(false); }}><Text style={styles.editProfileMenuText}>✏️ REDIGER PROFIL</Text></TouchableOpacity>
                </View>
              )}
              <TouchableOpacity style={styles.menuItem} onPress={() => { setCurrentScreen('home'); setMenuOpen(false); }}><Text style={styles.menuItemText}>🏠 FORSIDE</Text></TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => { setCurrentScreen('tipspil'); setMenuOpen(false); }}><Text style={styles.menuItemText}>⚽ TIPSSPIL</Text></TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => { setSelectedThread(null); setSelectedCategory(null); setCurrentScreen('forum'); setMenuOpen(false); }}><Text style={styles.menuItemText}>💬 FORUM</Text></TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => { setSelectedSong(null); setShowSongForm(false); setCurrentScreen('songs'); setMenuOpen(false); }}><Text style={styles.menuItemText}>🎵 SANGE & TEKSTER</Text></TouchableOpacity>
              {canViewAwayInfo && <TouchableOpacity style={styles.menuItem} onPress={() => { setSelectedAwayInfo(null); setCurrentScreen('awayInfo'); setMenuOpen(false); }}><Text style={styles.menuItemText}>🚌 AWAY INFO</Text></TouchableOpacity>}
              {isAdmin && <TouchableOpacity style={styles.adminMenuBtn} onPress={() => { setCurrentScreen('adminHub'); setMenuOpen(false); }}><Text style={styles.adminMenuText}>🛠️ ADMIN PANEL {adminNotificationsCount > 0 && <Text style={{color: '#E30613'}}>🔴</Text>}</Text></TouchableOpacity>}
              <View style={styles.menuDivider} />
              
              {!user ? (
                <View style={{flexDirection: 'row', gap: 10}}>
                  <TouchableOpacity style={[styles.loginButtonMenu, {flex: 1}]} onPress={() => { setCurrentScreen('login'); setMenuOpen(false); }}><Text style={styles.loginButtonMenuText}>👤 LOG IND</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.loginButtonMenu, {flex: 1, backgroundColor: '#C5A059'}]} onPress={() => { setCurrentScreen('signup'); setMenuOpen(false); }}><Text style={styles.loginButtonMenuText}>✏️ OPRET</Text></TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.loginButtonMenu} onPress={() => { auth.signOut().then(()=>setMenuOpen(false)); }}><Text style={styles.loginButtonMenuText}>LOG UD</Text></TouchableOpacity>
              )}
            </View>
          </>
        )}
      </>
    );
  };

  if (currentScreen === 'home') {
    const nextMatchAwayInfo = nextMatch && nextMatch.awayTeam === 'AB' ? awayInfoList.find(a => a.matchId === nextMatch.id || a.opponent === nextMatch.homeTeam) : null;
    const isLiveNext = nextMatch && isMatchLive(nextMatch.matchDate);

    return (
      <View style={{flex: 1}}>
        <TopBarMenu />
        <ScrollView contentContainerStyle={styles.feedContainer}>
          <Text style={styles.sectionTitle}>Officielle Fan Nyheder</Text>
          {isEditor && <TouchableOpacity style={[styles.primaryButton, {marginBottom: 15}]} onPress={() => { setCurrentScreen('adminNews'); }}><Text style={styles.primaryButtonText}>➕ ADMINISTRER NYHEDER</Text></TouchableOpacity>}
          {newsList.map((item) => (
            <TouchableOpacity key={item.id} style={styles.newsCard} onPress={() => { setSelectedNews(item); setCurrentScreen('newsDetail'); }}>
              <Image source={{uri: item.image}} style={styles.newsImage} />
              <View style={styles.newsTextContainer}><Text style={styles.newsTitle}>{item.title}</Text><Text style={styles.newsDate}>{item.createdAt ? formatDanishDate(item.createdAt) : item.date} ➔ LÆS MERE</Text></View>
            </TouchableOpacity>
          ))}

          <View style={styles.matchCardWidget}>
            <View style={styles.matchWidgetTopBar}><Text style={styles.matchWidgetHeader}>⚽ NÆSTE KAMP</Text></View>
            {nextMatch ? (
              <View style={styles.matchWidgetBody}>
                <View style={styles.matchTeamColumn}><Image source={{ uri: getTeamLogo(nextMatch.homeTeam) }} style={styles.matchTeamLogo} resizeMode="contain" /><Text style={styles.matchTeamName}>{nextMatch.homeTeam}</Text></View>
                <View style={styles.matchInfoColumn}>
                  <Text style={styles.matchTournamentBadge}>{nextMatch.tournament}</Text>
                  <Text style={styles.vsText}>VS</Text>
                  {isLiveNext ? (
                    <Animated.Text style={{ color: '#2E7D32', fontWeight: '900', fontSize: 18, opacity: pulseAnim, marginVertical: 4, textAlign: 'center' }}>LIVE</Animated.Text>
                  ) : (
                    <Text style={styles.matchDateBadge}>{formatDanishDate(nextMatch.matchDate)}</Text>
                  )}
                  <Text style={styles.matchStadiumText}>📍 {nextMatch.alternativeStadium || getStadium(nextMatch.homeTeam)}</Text>
                  {canViewAwayInfo && nextMatchAwayInfo && <TouchableOpacity onPress={() => { setSelectedAwayInfo(nextMatchAwayInfo); setCurrentScreen('awayInfo'); }} style={{backgroundColor: '#12352A', padding: 6, borderRadius: 4, marginTop: 8}}><Text style={{color: '#C5A059', fontSize: 10, fontWeight: 'bold'}}>🚌 SE AWAY INFO</Text></TouchableOpacity>}
                </View>
                <View style={styles.matchTeamColumn}><Image source={{ uri: getTeamLogo(nextMatch.awayTeam) }} style={styles.matchTeamLogo} resizeMode="contain" /><Text style={styles.matchTeamName}>{nextMatch.awayTeam}</Text></View>
              </View>
            ) : <Text style={{textAlign: 'center', color: '#666', fontStyle: 'italic', padding: 15}}>Ingen kommende kampe fundet.</Text>}
          </View>

          <View style={[styles.matchCardWidget, { marginTop: 10 }]}>
            <View style={[styles.matchWidgetTopBar, { flexDirection: 'row', justifyContent: 'space-between' }]}>
              <Text style={styles.matchWidgetHeader}>📅 KOMMENDE KAMPE</Text>
              <View style={{ flexDirection: 'row', gap: 5 }}>
                {['All', 'Home', 'Away'].map(filter => (<TouchableOpacity key={filter} onPress={() => ctx.setUpcomingFilter(filter)} style={{ backgroundColor: ctx.upcomingFilter === filter ? '#C5A059' : '#0B221B', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}><Text style={{ color: ctx.upcomingFilter === filter ? '#111' : '#FFF', fontSize: 9, fontWeight: 'bold' }}>{filter.toUpperCase()}</Text></TouchableOpacity>))}
              </View>
            </View>
            <View style={{ padding: 10 }}>
              {upcomingMatchesToDisplay.length > 0 ? upcomingMatchesToDisplay.map(m => {
                const awayInfo = m.awayTeam === 'AB' ? awayInfoList.find(a => a.matchId === m.id || a.opponent === m.homeTeam) : null;
                const isItemLive = isMatchLive(m.matchDate);
                return (
                  <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0F0EA' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <Image source={{ uri: getTeamLogo(m.homeTeam) }} style={{ width: 25, height: 25, marginRight: 5 }} resizeMode="contain" />
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#12352A' }}>{m.homeTeam}</Text><Text style={{ fontSize: 10, marginHorizontal: 5, color: '#888' }}>vs</Text>
                      <Image source={{ uri: getTeamLogo(m.awayTeam) }} style={{ width: 25, height: 25, marginRight: 5 }} resizeMode="contain" /><Text style={{ fontSize: 12, fontWeight: 'bold', color: '#12352A' }}>{m.awayTeam}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      {isItemLive ? (
                        <Animated.Text style={{ color: '#2E7D32', fontWeight: '900', fontSize: 11, opacity: pulseAnim }}>LIVE</Animated.Text>
                      ) : (
                        <Text style={{ fontSize: 10, color: '#666' }}>{formatShortDateWithTime(m.matchDate)}</Text>
                      )}
                      {canViewAwayInfo && awayInfo && <TouchableOpacity onPress={() => { setSelectedAwayInfo(awayInfo); setCurrentScreen('awayInfo'); }} style={{ backgroundColor: '#12352A', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3, marginTop: 2 }}><Text style={{ color: '#C5A059', fontSize: 8, fontWeight: 'bold' }}>🚌 AWAY INFO</Text></TouchableOpacity>}
                    </View>
                  </View>
                )
              }) : <Text style={{ textAlign: 'center', color: '#666', fontStyle: 'italic', fontSize: 12 }}>Ingen planlagte kampe.</Text>}
            </View>
          </View>

          <View style={styles.homeLeaderboardCard}>
            <Text style={styles.sectionTitle}>🏆 Tipspil Top 3</Text>
            {activeLeaderboard.slice(0, 3).map((item, index) => {
              const itemLivePhoto = getLiveAuthorPhoto(item.id, item.photoURL);
              return (
                <TouchableOpacity key={item.id} onPress={() => handleOpenProfile(item.id)} style={styles.homeLbRow}>
                  <Image source={{ uri: itemLivePhoto }} style={styles.lbAvatar} />
                  <Text style={{flex: 1, fontWeight: 'bold', color: '#12352A'}}>{index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`} {item.username}</Text>
                  <Text style={{fontWeight: '900', color: '#C5A059'}}>{item.points || 0} pts</Text>
                </TouchableOpacity>
              );
            })}
            {lastFinishedRoundName && lastRoundTopTipsters.length > 0 && (
              <View style={{marginTop: 15, borderTopWidth: 1, borderTopColor: '#F0F0EA', paddingTop: 10}}>
                <Text style={{fontSize: 12, fontWeight: 'bold', color: '#12352A', marginBottom: 5}}>Bedst i {lastFinishedRoundName}:</Text>
                {lastRoundTopTipsters.map((item, index) => (
                  <View key={item.id} style={{flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2}}><Text style={{fontSize: 12, color: '#333'}}>{index + 1}. {item.username}</Text><Text style={{fontSize: 12, color: '#C5A059', fontWeight: 'bold'}}>{item.roundPoints?.[lastFinishedRoundName] || 0} pts</Text></View>
                ))}
              </View>
            )}
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setCurrentScreen('tipspil')}><Text style={styles.secondaryButtonText}>SE HELE RANGLISTEN & SPIL MED ➔</Text></TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>💬 Seneste Forum Debatter</Text>
          <View style={styles.homeLeaderboardCard}>
            {visibleThreads.slice(0, 4).length === 0 ? <Text style={{fontStyle: 'italic', color: '#666'}}>Ingen debatter endnu.</Text> : visibleThreads.slice(0, 4).map(t => (
              <TouchableOpacity key={t.id} onPress={() => { setSelectedCategory(forumCategories.find(c => c.id === t.categoryId) || forumCategories[0]); setSelectedThread(t); setCurrentScreen('forum'); }} style={{paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0F0EA'}}>
                <Text style={{fontWeight: 'bold', color: '#12352A'}} numberOfLines={1}>{t.title}</Text><Text style={{fontSize: 11, color: '#666'}}>Af {t.authorName}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.secondaryButton, {marginTop: 10}]} onPress={() => { setSelectedThread(null); setSelectedCategory(null); setCurrentScreen('forum'); }}><Text style={styles.secondaryButtonText}>GÅ TIL FORUM ➔</Text></TouchableOpacity>
          </View>

          {rssNews.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>📰 Seneste fra nettet</Text>
              {rssNews.map((item, index) => (
                <TouchableOpacity key={index} style={styles.rssCard} onPress={() => Linking.openURL(item.link)}>
                  <Text style={styles.rssTitle}>{item.title}</Text>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 5}}><Text style={styles.rssDate}>{formatDanishDate(item.pubDate)}</Text><Text style={{fontSize: 10, color: '#C5A059', fontWeight: 'bold'}}>{item.sourceName}</Text></View>
                </TouchableOpacity>
              ))}
            </>
          )}
          <View style={{height: 50}} />
        </ScrollView>
        {renderProfileModal()}
      </View>
    );
  }

  if (currentScreen === 'tipspil') {
    useEffect(() => {
      if (user) {
        db.collection('users').doc(user.uid).update({ lastSeenTipspil: Date.now() }).catch(()=>{});
      }
    }, []);

    const uniqueRounds = [...new Set(matchesList.map(m => m.round))];
    if (uniqueRounds.length > 0 && !uniqueRounds.includes(selectedRound)) setSelectedRound(uniqueRounds[0]);

    const currentRoundMatches = matchesList.filter(m => m.round === selectedRound);
    const isCupRound = selectedRound.toLowerCase().includes('pokal');
    const hasActiveMatches = currentRoundMatches.some(m => !isMatchLocked(m.matchDate) && !m.finalScore);

    const activeDoubleUpId = ctx.userPredictions[selectedRound]?.dobbeltOpMatchId || ctx.userPredictions[selectedRound]?.jokerMatchId;
    const activeDoubleUpMatch = currentRoundMatches.find(m => m.id === activeDoubleUpId);
    const isDoubleUpLockedByMatch = activeDoubleUpMatch ? (isMatchLocked(activeDoubleUpMatch.matchDate) || activeDoubleUpMatch.finalScore) : false;
    const roundLeaderboard = [...activeLeaderboard].sort((a, b) => (b.roundPoints?.[selectedRound] || 0) - (a.roundPoints?.[selectedRound] || 0)).slice(0, 5);

    const openGuessesModal = async (match) => {
      setSelectedMatchForGuesses(match); setShowGuessesModal(true); setIsLoadingGuesses(true);
      try {
        const snap = await db.collection('users').get(); let guesses = [];
        for (let doc of snap.docs) {
          const pSnap = await db.collection('users').doc(doc.id).collection('predictions').doc('current').get();
          if (pSnap.exists) {
            const data = pSnap.data();
            if (data[match.id] && data[match.id].home !== undefined && data[match.id].home !== '') {
              guesses.push({ userId: doc.id, username: doc.data().username, photoURL: doc.data().photoURL, home: data[match.id].home, away: data[match.id].away, earned: data[match.id].earnedPoints || 0, isDoubleUp: (data[match.round]?.dobbeltOpMatchId === match.id) });
            }
          }
        }
        setMatchGuessesList(guesses);
      } catch(e) {} finally { setIsLoadingGuesses(false); }
    };

    return (
      <View style={{flex: 1}}>
        <TopBarMenu />
        <ScrollView contentContainerStyle={styles.detailContainer}>
          <TouchableOpacity onPress={() => setCurrentScreen('home')} style={styles.backButton}><Text style={styles.backButtonText}>← TILBAGE</Text></TouchableOpacity>

          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10}}>
            <Text style={styles.loginHeader}>⚽ TIPSSPIL</Text>
            <TouchableOpacity onPress={() => setShowRulesModal(true)} style={{backgroundColor: '#C5A059', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6}}><Text style={{color: '#111', fontWeight: 'bold', fontSize: 11}}>📖 REGLER</Text></TouchableOpacity>
          </View>

          {uniqueRounds.length > 0 && (
            <View style={styles.roundSelectorRow}>
              <TouchableOpacity onPress={() => { const idx = uniqueRounds.indexOf(selectedRound); if (idx > 0) setSelectedRound(uniqueRounds[idx - 1]); }}><Text style={{fontWeight: 'bold', color: '#12352A'}}>◀ FORRIGE</Text></TouchableOpacity>
              <Text style={styles.currentRoundText}>{selectedRound}</Text>
              <TouchableOpacity onPress={() => { const idx = uniqueRounds.indexOf(selectedRound); if (idx < uniqueRounds.length - 1) setSelectedRound(uniqueRounds[idx + 1]); }}><Text style={{fontWeight: 'bold', color: '#12352A'}}>NÆSTE ▶</Text></TouchableOpacity>
            </View>
          )}

          {user ? (
            <>
              {!isCupRound && <Text style={{fontSize: 12, color: '#555', fontStyle: 'italic', marginBottom: 10}}>💡 Tip: Tryk på ⭐ for at vælge din DOBBELT OP-kamp.</Text>}
              {isCupRound && <Text style={{fontSize: 12, color: '#E30613', fontStyle: 'italic', marginBottom: 10}}>🏆 Pokalrunde: Dobbelt op-bonus er deaktiveret.</Text>}
              {currentRoundMatches.map((m) => {
                const hStyle = getTeamStyle(m.homeTeam); const aStyle = getTeamStyle(m.awayTeam);
                const isDoubleUp = activeDoubleUpId === m.id; const locked = isMatchLocked(m.matchDate) || m.finalScore;
                const isMatchItemLive = isMatchLive(m.matchDate) && !m.finalScore;

                return (
                  <TouchableOpacity activeOpacity={locked ? 0.7 : 1} onPress={() => locked && openGuessesModal(m)} key={m.id} style={[styles.matchCard, isDoubleUp && {borderColor: '#C5A059', borderWidth: 2}, locked && {opacity: 0.9, backgroundColor: '#F0F0EA'}]}>
                    <View style={{marginBottom: 4}}><Text style={{fontSize: 10, color: '#12352A', fontWeight: '900', textTransform: 'uppercase'}}>{m.tournament || 'Betinia Liga'}</Text></View>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'flex-start', flexWrap: 'wrap', gap: 6}}>
                      {isMatchItemLive ? (
                        <Animated.Text style={{ color: '#2E7D32', fontWeight: '900', fontSize: 14, opacity: pulseAnim }}>🔴 LIVE</Animated.Text>
                      ) : (
                        <Text style={[styles.matchRoundText, locked && {color: '#888'}, {flex: 1, minWidth: '50%'}]}>📅 {formatDanishDate(m.matchDate)} {m.finalScore ? `\nRes:${m.homeScore}-${m.awayScore}` : ''} {locked && <Text style={{color: '#C5A059', fontStyle: 'italic'}}> 👁 Se andres gæt</Text>}</Text>
                      )}
                      {!isCupRound && !m.finalScore && (
                        <View style={{flexShrink: 0}}>
                          {!locked ? ((!isDoubleUpLockedByMatch || isDoubleUp) && (
                              <TouchableOpacity onPress={() => ctx.setUserPredictions({...ctx.userPredictions, [selectedRound]: { ...(ctx.userPredictions[selectedRound] || {}), jokerMatchId: m.id }})} style={{backgroundColor: isDoubleUp ? '#C5A059' : '#E5E5DF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4}}><Text style={{fontSize: 10, fontWeight: 'bold', color: isDoubleUp ? '#111' : '#555'}}>{isDoubleUp ? '⭐ DOBBELT OP VALGT' : '☆ VÆLG DOBBELT OP'}</Text></TouchableOpacity>
                            )) : (isDoubleUp && <View style={{backgroundColor: '#C5A059', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, opacity: 0.8}}><Text style={{fontSize: 10, fontWeight: 'bold', color: '#111'}}>⭐ DOBBELT OP LÅST</Text></View>)}
                        </View>
                      )}
                    </View>

                    {/* Hvis kampen er færdigspillet, vis stort resultat og farvekodet gæt */}
                    {m.finalScore ? (
                      <View style={{alignItems: 'center', marginVertical: 8, backgroundColor: '#F7F7F2', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E5E5DF'}}>
                        <Text style={{fontSize: 10, fontWeight: 'bold', color: '#666', textTransform: 'uppercase', marginBottom: 2}}>Endeligt Resultat</Text>
                        <Text style={{fontSize: 22, fontWeight: '900', color: '#12352A', marginBottom: 6}}>{m.homeScore} - {m.awayScore}</Text>
                        
                        {(() => {
                          const userPred = ctx.userPredictions[m.id] || { home: '', away: '' };
                          const pH = userPred.home !== '' ? parseInt(userPred.home, 10) : null;
                          const pA = userPred.away !== '' ? parseInt(userPred.away, 10) : null;

                          let bgCol = '#E30613'; // Rød for forkert
                          let txtDesc = 'Forkert (0 p)';
                          if (pH !== null && pA !== null) {
                            const isExact = pH === m.homeScore && pA === m.awayScore;
                            const isSign = !isExact && ((pH > pA && m.homeScore > m.awayScore) || (pH < pA && m.homeScore < m.awayScore) || (pH === pA && m.homeScore === m.awayScore));
                            if (isExact) {
                              bgCol = '#12352A'; // Mørkegrønt for præcist
                              txtDesc = 'Præcist gæt! (3 pts)';
                            } else if (isSign) {
                              bgCol = '#4CAF50'; // Lysere grønt for 1X2
                              txtDesc = 'Rigtig 1X2! (1 pt)';
                            }
                          } else {
                            txtDesc = 'Ingen gæt afgivet';
                          }

                          return (
                            <View style={{backgroundColor: bgCol, width: '100%', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, alignItems: 'center'}}>
                              <Text style={{color: '#fff', fontSize: 11, fontWeight: 'bold'}}>
                                Dit gæt: {userPred.home !== '' ? userPred.home : '-'} - {userPred.away !== '' ? userPred.away : '-'} ({txtDesc})
                              </Text>
                            </View>
                          );
                        })()}
                      </View>
                    ) : (
                      <View style={styles.matchTeamsRow}>
                        <ImageBackground source={{ uri: getTeamLogo(m.homeTeam) }} style={[styles.teamBadgeWithLogo, {backgroundColor: hStyle.backgroundColor}, locked && {opacity: 0.5}]} imageStyle={{ opacity: 0.3, blurRadius: 2 }} resizeMode="cover"><View style={styles.darkOverlay} /><Text style={[styles.teamBadgeText, {color: '#FFFFFF'}]} numberOfLines={1}>{m.homeTeam}</Text></ImageBackground>
                        <TextInput editable={!locked} style={[styles.scoreInput, locked && {backgroundColor: '#e0e0e0', color: '#888', borderColor: '#ccc'}]} keyboardType="numeric" maxLength={2} placeholder="-" value={ctx.userPredictions[m.id]?.home || ''} onChangeText={(val) => ctx.setUserPredictions({...ctx.userPredictions, [m.id]: {...ctx.userPredictions[m.id], home: val}})} />
                        <Text style={{fontWeight: 'bold', marginHorizontal: 4, color: locked ? '#888' : '#111'}}>-</Text>
                        <TextInput editable={!locked} style={[styles.scoreInput, locked && {backgroundColor: '#e0e0e0', color: '#888', borderColor: '#ccc'}]} keyboardType="numeric" maxLength={2} placeholder="-" value={ctx.userPredictions[m.id]?.away || ''} onChangeText={(val) => ctx.setUserPredictions({...ctx.userPredictions, [m.id]: {...ctx.userPredictions[m.id], away: val}})} />
                        <ImageBackground source={{ uri: getTeamLogo(m.awayTeam) }} style={[styles.teamBadgeWithLogo, {backgroundColor: aStyle.backgroundColor}, locked && {opacity: 0.5}]} imageStyle={{ opacity: 0.3, blurRadius: 2 }} resizeMode="cover"><View style={styles.darkOverlay} /><Text style={[styles.teamBadgeText, {color: '#FFFFFF'}]} numberOfLines={1}>{m.awayTeam}</Text></ImageBackground>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
              {hasActiveMatches && <TouchableOpacity style={styles.primaryButton} onPress={async () => { await db.collection('users').doc(user.uid).collection('predictions').doc('current').set(ctx.userPredictions, { merge: true }); showAlert("Succes", "Dine tipspil-gæt er gemt!"); logActivity('tips', `${userData?.username || 'Bruger'} opdaterede sine tipspil-gæt`, userData?.username); }}><Text style={styles.primaryButtonText}>GEM MINE GÆT & DOBBELT OP</Text></TouchableOpacity>}
            </>
          ) : <TouchableOpacity style={styles.primaryButton} onPress={() => setCurrentScreen('login')}><Text style={styles.primaryButtonText}>LOG IND FOR AT SPILLE</Text></TouchableOpacity>}

          <View style={{backgroundColor: '#FFFFFF', borderRadius: 12, padding: 15, marginTop: 25, marginBottom: 10, borderWidth: 1, borderColor: '#E5E5DF'}}>
            <Text style={{fontSize: 16, fontWeight: '800', color: '#12352A', marginBottom: 10, textTransform: 'uppercase'}}>🔥 Bedste Tippere ({selectedRound})</Text>
            {roundLeaderboard.length > 0 && roundLeaderboard[0].roundPoints?.[selectedRound] ? roundLeaderboard.map((u, i) => {
              const uLivePhoto = getLiveAuthorPhoto(u.id, u.photoURL);
              return (
                <View key={u.id} style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#F0F0EA'}}>
                  <View style={{flexDirection: 'row', alignItems: 'center'}}><Image source={{uri: uLivePhoto}} style={{width: 20, height: 20, borderRadius: 10, marginRight: 6}} /><Text style={{fontSize: 13, color: '#333'}}>{i + 1}. {u.username}</Text></View>
                  <Text style={{fontSize: 13, color: '#C5A059', fontWeight: 'bold'}}>{u.roundPoints[selectedRound]} pts</Text>
                </View>
              );
            }) : <Text style={{fontStyle: 'italic', color: '#666', fontSize: 12}}>Ingen point uddelt endnu.</Text>}
          </View>

          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 10}}>
            <Text style={styles.sectionTitle}>🏆 Samlet Rangliste</Text>
            <TouchableOpacity onPress={() => setShowAdvancedLb(!showAdvancedLb)} style={{backgroundColor: '#12352A', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4}}><Text style={{color: '#C5A059', fontSize: 10, fontWeight: 'bold'}}>{showAdvancedLb ? 'NORMAL STILLING' : 'AVANCERET STILLING'}</Text></TouchableOpacity>
          </View>
          {showAdvancedLb && (<View style={{flexDirection: 'row', paddingHorizontal: 10, marginBottom: 5}}><Text style={{flex: 1.5, fontSize: 10, color: '#666'}}>Bruger</Text><Text style={{width: 35, fontSize: 10, color: '#666', textAlign: 'center'}}>3p</Text><Text style={{width: 35, fontSize: 10, color: '#666', textAlign: 'center'}}>1p</Text><Text style={{width: 35, fontSize: 10, color: '#666', textAlign: 'center'}}>0p</Text><Text style={{width: 45, fontSize: 10, color: '#666', textAlign: 'center'}}>1X2%</Text></View>)}
          
          {activeLeaderboard.map((u, i) => {
            const isMe = user && u.id === user.uid;
            const stats = u.stats || { exactHits: 0, signHits: 0, misses: 0, doubleUpHits: 0 };
            const hitPct = (stats.exactHits + stats.signHits + stats.misses) > 0 ? Math.round(((stats.exactHits + stats.signHits) / (stats.exactHits + stats.signHits + stats.misses)) * 100) : 0;
            const uLivePhoto = getLiveAuthorPhoto(u.id, u.photoURL);
            return (
              <TouchableOpacity key={u.id} onPress={() => handleOpenProfile(u.id)} style={[styles.lbRow, isMe && styles.myLbRow]}>
                <Text style={styles.lbRank}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</Text>
                {showAdvancedLb ? (
                  <><Text style={[{flex: 1.5, fontWeight: 'bold', fontSize: 12}, isMe ? {color: '#FFFFFF'} : {color: '#12352A'}]} numberOfLines={1}>{u.username}</Text><Text style={{width: 35, textAlign: 'center', fontSize: 12, color: isMe ? '#eee' : '#555'}}>{stats.exactHits}</Text><Text style={{width: 35, textAlign: 'center', fontSize: 12, color: isMe ? '#eee' : '#555'}}>{stats.signHits}</Text><Text style={{width: 35, textAlign: 'center', fontSize: 12, color: isMe ? '#eee' : '#555'}}>{stats.misses}</Text><Text style={{width: 45, textAlign: 'center', fontSize: 12, fontWeight: 'bold', color: '#C5A059'}}>{hitPct}%</Text></>
                ) : (
                  <><Image source={{ uri: uLivePhoto }} style={styles.lbAvatar} /><Text style={[{flex: 1, fontWeight: 'bold'}, isMe ? {color: '#FFFFFF'} : {color: '#12352A'}]}>{u.username}</Text><Text style={{fontWeight: '900', color: '#C5A059'}}>{u.points || 0} p</Text></>
                )}
              </TouchableOpacity>
            )
          })}

          <Modal visible={showGuessesModal} transparent animationType="slide">
            <View style={styles.modalOverlay}>
              <View style={styles.modalContainer}>
                <Text style={styles.modalHeader}>Brugernes Gæt</Text>
                <Text style={{marginBottom: 10, fontStyle: 'italic', color: '#666', textAlign: 'center'}}>{selectedMatchForGuesses?.homeTeam} vs {selectedMatchForGuesses?.awayTeam}</Text>
                {isLoadingGuesses ? <Text>Henter gæt...</Text> : (
                  <ScrollView style={{maxHeight: 300, width: '100%'}}>
                    {matchGuessesList.length > 0 ? matchGuessesList.map((g, index) => {
                      const gLivePhoto = getLiveAuthorPhoto(g.userId, g.photoURL);
                      return (
                        <View key={index} style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee'}}>
                          <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}><Image source={{uri: gLivePhoto}} style={{width: 20, height: 20, borderRadius: 10, marginRight: 8}} /><Text style={{fontWeight: 'bold', fontSize: 12}} numberOfLines={1}>{g.username} {g.isDoubleUp && '⭐'}</Text></View>
                          <Text style={{color: '#12352A', fontWeight: 'bold', marginHorizontal: 10}}>{g.home} - {g.away}</Text><Text style={{color: '#C5A059', fontWeight: 'bold'}}>{g.earned} p</Text>
                        </View>
                      );
                    }) : <Text style={{textAlign: 'center', color: '#888'}}>Ingen gæt fundet for denne kamp.</Text>}
                  </ScrollView>
                )}
                <TouchableOpacity style={[styles.primaryButton, {width: '100%', marginTop: 15}]} onPress={() => setShowGuessesModal(false)}><Text style={styles.primaryButtonText}>LUK</Text></TouchableOpacity>
              </View>
            </View>
          </Modal>

          <Modal visible={showRulesModal} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={styles.modalContainer}>
                <Text style={styles.modalHeader}>📖 TIPSPIL REGLER</Text>
                <ScrollView style={{maxHeight: 350, width: '100%', marginBottom: 15}}>
                  <Text style={{fontSize: 13, color: '#333', lineHeight: 20, marginBottom: 10}}>Grundlæggende Point:{'\n'}• Rigtig vinder eller uafgjort (1X2): <Text style={{fontWeight: 'bold'}}>1 point</Text>.{'\n'}• Helt præcist kampresultat (Målscore): <Text style={{fontWeight: 'bold'}}>3 point</Text>.</Text>
                  <Text style={{fontSize: 13, color: '#333', lineHeight: 20, marginBottom: 10}}>Dobbelt Op (⭐):{'\n'}• I hver divisionsrunde kan du vælge én Dobbelt Op-kamp.{'\n'}• Dine point for netop dén kamp ganges med 2!{'\n'}• Vigtigt: Du kan ikke ændre Dobbelt Op, når kampen er gået i gang.{'\n'}• <Text style={{color: '#E30613'}}>Gælder IKKE i pokalkampe.</Text></Text>
                  <Text style={{fontSize: 13, color: '#333', lineHeight: 20}}>Låsning og Statistik:{'\n'}• Gæt og Dobbelt Op låses 5 minutter før kampstart.{'\n'}• Træfsikkerhed udregnes ud fra, hvor ofte du rammer mindst det rigtige tegn (1X2). Kampe du ikke nå at gætte på, tæller ikke med som forbi-skud.</Text>
                </ScrollView>
                <TouchableOpacity style={[styles.primaryButton, {width: '100%'}]} onPress={() => setShowRulesModal(false)}><Text style={styles.primaryButtonText}>FORSTÅET</Text></TouchableOpacity>
              </View>
            </View>
          </Modal>
          <View style={{height: 40}} />
        </ScrollView>
        {renderProfileModal()}
      </View>
    );
  }

  if (currentScreen === 'forum') {
    useEffect(() => {
      if (user) {
        db.collection('users').doc(user.uid).update({ lastSeenForum: firebase.firestore.FieldValue.serverTimestamp() }).catch(()=>{});
      }
    }, []);

    if (selectedThread) {
      const threadLivePhoto = getLiveAuthorPhoto(selectedThread.authorId, selectedThread.authorPhoto);
      return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
          <TopBarMenu />
          <ScrollView contentContainerStyle={styles.detailContainer}>
            <TouchableOpacity onPress={() => setSelectedThread(null)} style={styles.backButton}><Text style={styles.backButtonText}>← TILBAGE TIL TRÅDE</Text></TouchableOpacity>
            <View style={styles.detailCard}>
              <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 10}}>
                <TouchableOpacity onPress={() => handleOpenProfile(selectedThread.authorId)}><Image source={{uri: threadLivePhoto}} style={{width: 35, height: 35, borderRadius: 17.5, marginRight: 10, borderWidth: 1, borderColor: '#C5A059'}} /></TouchableOpacity>
                <View style={{flex: 1}}>
                  <TouchableOpacity onPress={() => handleOpenProfile(selectedThread.authorId)}><Text style={{fontWeight: 'bold', color: '#12352A'}}>{selectedThread.authorName}</Text></TouchableOpacity>
                  <Text style={{fontSize: 10, color: '#C5A059', fontWeight: 'bold'}}>{selectedThread.authorRole}</Text>
                  {selectedThread.authorFractions?.length > 0 && <Text style={{fontSize: 10, color: '#12352A', fontWeight: 'bold', fontStyle: 'italic'}}>{selectedThread.authorFractions.join(', ')}</Text>}
                </View>
                {user && user.uid !== selectedThread.authorId && (<TouchableOpacity onPress={() => openUGCMenu('thread', selectedThread.id, selectedThread.authorId, selectedThread.authorName)}><Text style={{color: '#8A1C1C', fontSize: 16}}>⚠</Text></TouchableOpacity>)}
                {(isAdmin || user?.uid === selectedThread.authorId) && (<TouchableOpacity style={{marginLeft: 15}} onPress={() => Alert.alert("Slet", "Vil du slette?", [{ text: "Annuller" }, { text: "Slet", style: "destructive", onPress: async () => { await db.collection('forum_threads').doc(selectedThread.id).delete(); setSelectedThread(null); }}])}><Text style={{color: '#8A1C1C', fontWeight: 'bold', fontSize: 12}}>SLET</Text></TouchableOpacity>)}
              </View>
              <Text style={styles.detailTitle}>{selectedThread.title}</Text>
              <Text style={{fontSize: 10, color: '#888', marginBottom: 8}}>{formatDanishDate(selectedThread.createdAt)}</Text>
              <Text style={styles.detailBody}>{selectedThread.content}</Text>
              {selectedThread.authorSignature ? (<View style={{borderTopWidth: 1, borderTopColor: '#E5E5DF', marginTop: 15, paddingTop: 8}}><Text style={{fontSize: 11, color: '#666', fontStyle: 'italic'}}>{selectedThread.authorSignature}</Text></View>) : null}
            </View>

            <Text style={[styles.sectionTitle, {marginTop: 20}]}>Svar ({visibleReplies.length})</Text>
            {visibleReplies.map((r) => {
              const replyLivePhoto = getLiveAuthorPhoto(r.authorId, r.authorPhoto);
              return (
                <View key={r.id} style={styles.commentRow}>
                  <TouchableOpacity onPress={() => handleOpenProfile(r.authorId)}><Image source={{ uri: replyLivePhoto }} style={styles.commentAvatar} /></TouchableOpacity>
                  <View style={{flex: 1}}>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                      <TouchableOpacity onPress={() => handleOpenProfile(r.authorId)}>
                        <Text style={styles.commentUser}>{r.authorName}</Text><Text style={{fontSize: 9, color: '#C5A059', fontWeight: 'bold'}}>{r.authorRole}</Text>
                        {r.authorFractions?.length > 0 && <Text style={{fontSize: 9, color: '#12352A', fontWeight: 'bold', fontStyle: 'italic'}}>{r.authorFractions.join(', ')}</Text>}
                      </TouchableOpacity>
                      <View style={{flexDirection: 'row'}}>
                        {user && user.uid !== r.authorId && (<TouchableOpacity onPress={() => openUGCMenu('reply', r.id, r.authorId, r.authorName)}><Text style={{color: '#8A1C1C', fontSize: 14, marginRight: 10}}>⚠</Text></TouchableOpacity>)}
                        {(isAdmin || user?.uid === r.authorId) && (<TouchableOpacity onPress={() => Alert.alert("Slet", "Vil du slette?", [{ text: "Annuller" }, { text: "Slet", style: "destructive", onPress: async () => { await db.collection('forum_threads').doc(selectedThread.id).collection('replies').doc(r.id).delete(); }}])}><Text style={{color: '#8A1C1C', fontSize: 10, fontWeight: 'bold'}}>SLET</Text></TouchableOpacity>)}
                      </View>
                    </View>
                    <Text style={[styles.commentText, {marginTop: 4}]}>{r.content}</Text>
                    {r.authorSignature ? <Text style={{fontSize: 10, color: '#888', fontStyle: 'italic', marginTop: 4}}>{r.authorSignature}</Text> : null}
                  </View>
                </View>
              );
            })}

            {user ? (
              ctx.appSettings.forumLocked && !isAdmin ? (<Text style={{color: '#E30613', fontStyle: 'italic', textAlign: 'center', marginVertical: 15}}>Forummet er midlertidigt låst for nye indlæg.</Text>) : (
                <View style={styles.commentInputContainer}>
                  <TextInput style={styles.commentInput} placeholder="Skriv et svar..." placeholderTextColor="#888" value={newReplyContent} onChangeText={newReplyContent => {
                    db.collection('users').doc(user.uid).set({ seenForumThreadIds: firebase.firestore.FieldValue.arrayUnion(selectedThread.id) }, { merge: true }).catch(()=>{});
                    setNewReplyContent(newReplyContent);
                  }} />
                  <TouchableOpacity style={styles.commentSendBtn} onPress={async () => { if (!newReplyContent.trim()) return; await db.collection('forum_threads').doc(selectedThread.id).collection('replies').add({ content: newReplyContent, authorId: user.uid, authorName: userData?.username || 'Fan', authorPhoto: userData?.photoURL || '', authorRole: isSuperAdmin ? 'Super Admin' : (userData?.role || 'Alm. Bruger'), authorFractions: userData?.hideFractions ? [] : (userData?.fractions || []), authorSignature: userData?.signature || '', createdAt: firebase.firestore.FieldValue.serverTimestamp() }); setNewReplyContent(''); }}><Text style={{color: '#FFFFFF', fontWeight: 'bold'}}>SEND</Text></TouchableOpacity>
                </View>
              )
            ) : (<Text style={{color: '#666', fontStyle: 'italic', textAlign: 'center', marginVertical: 15}}>Log ind for at svare.</Text>)}
            <View style={{height: 60}} />
          </ScrollView>
          {renderProfileModal()}
        </KeyboardAvoidingView>
      );
    }

    if (selectedCategory) {
      if (!canAccessCategory(selectedCategory)) {
        return (
          <View style={{flex: 1}}>
            <TopBarMenu />
            <ScrollView contentContainerStyle={styles.detailContainer}>
              <TouchableOpacity onPress={() => setSelectedCategory(null)} style={styles.backButton}><Text style={styles.backButtonText}>← TILBAGE</Text></TouchableOpacity>
              <Text style={styles.loginHeader}>Adgang nægtet</Text>
              <Text style={{textAlign: 'center', color: '#E30613', marginTop: 30}}>Du har ikke de nødvendige rettigheder til at se dette forum.</Text>
            </ScrollView>
          </View>
        );
      }
      const categoryThreads = visibleThreads.filter(t => t.categoryId === selectedCategory.id);
      return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
          <TopBarMenu />
          <ScrollView contentContainerStyle={styles.detailContainer}>
            <TouchableOpacity onPress={() => setSelectedCategory(null)} style={styles.backButton}><Text style={styles.backButtonText}>← TILBAGE TIL KATEGORIER</Text></TouchableOpacity>
            <Text style={styles.loginHeader}>💬 {selectedCategory.name}</Text>
            <Text style={styles.loginSubheader}>{selectedCategory.description}</Text>

            {user ? (
              ctx.appSettings.forumLocked && !isAdmin ? (
                <View style={{backgroundColor: '#FFFFFF', padding: 15, borderRadius: 10, marginBottom: 20, alignItems: 'center', borderWidth: 1, borderColor: '#E30613'}}><Text style={{color: '#E30613', fontWeight: 'bold'}}>Forummet er midlertidigt låst.</Text></View>
              ) : (
                <View style={{backgroundColor: '#FFFFFF', padding: 15, borderRadius: 10, marginBottom: 20, borderWidth: 1, borderColor: '#C5A059'}}>
                  <Text style={[styles.sectionTitle, {fontSize: 14, marginTop: 0}]}>Opret ny debat</Text>
                  <TextInput style={styles.inputField} placeholder="Titel på debat" placeholderTextColor="#888" value={newThreadTitle} onChangeText={setNewThreadTitle} />
                  <TextInput style={[styles.inputField, {height: 80, textAlignVertical: 'top'}]} placeholder="Hvad vil du drøfte?" placeholderTextColor="#888" multiline value={newThreadContent} onChangeText={setNewThreadContent} />
                  <TouchableOpacity style={styles.primaryButton} onPress={async () => { if (!newThreadTitle.trim() || !newThreadContent.trim()) return showAlert("Fejl", "Udfyld alle felter."); await db.collection('forum_threads').add({ categoryId: selectedCategory.id, title: newThreadTitle, content: newThreadContent, authorId: user.uid, authorName: userData?.username || 'Fan', authorPhoto: userData?.photoURL || '', authorRole: isSuperAdmin ? 'Super Admin' : (userData?.role || 'Alm. Bruger'), authorFractions: userData?.hideFractions ? [] : (userData?.fractions || []), authorSignature: userData?.signature || '', createdAt: firebase.firestore.FieldValue.serverTimestamp() }); setNewThreadTitle(''); setNewThreadContent(''); showAlert("Succes", "Debat oprettet!"); }}><Text style={styles.primaryButtonText}>OPRET DEBAT</Text></TouchableOpacity>
                </View>
              )
            ) : (
              <View style={{backgroundColor: '#FFFFFF', padding: 15, borderRadius: 10, marginBottom: 20, alignItems: 'center', borderWidth: 1, borderColor: '#E5E5DF'}}>
                <Text style={{color: '#12352A', fontWeight: 'bold', marginBottom: 10}}>Du skal være logget ind for at oprette en debat.</Text>
                <TouchableOpacity style={[styles.primaryButton, {marginTop: 0, paddingVertical: 10, paddingHorizontal: 20}]} onPress={() => setCurrentScreen('login')}><Text style={styles.primaryButtonText}>LOG IND NU</Text></TouchableOpacity>
              </View>
            )}

            {categoryThreads.map((t) => (
              <TouchableOpacity key={t.id} style={styles.newsCard} onPress={() => {
                if (user) {
                  db.collection('users').doc(user.uid).set({ seenForumThreadIds: firebase.firestore.FieldValue.arrayUnion(t.id) }, { merge: true }).catch(()=>{});
                }
                setSelectedThread(t);
              }}>
                <View style={{padding: 15}}>
                  <Text style={{fontSize: 11, color: '#C5A059', fontWeight: 'bold', marginBottom: 4}}>{t.authorName} ({t.authorRole})</Text>
                  <Text style={styles.newsTitle}>{t.title}</Text>
                  <Text style={{fontSize: 10, color: '#888', marginBottom: 6}}>{formatDanishDate(t.createdAt)}</Text>
                  <Text style={styles.newsDate} numberOfLines={2}>{t.content}</Text>
                </View>
              </TouchableOpacity>
            ))}
            <View style={{height: 60}} />
          </ScrollView>
        </KeyboardAvoidingView>
      );
    }

    const visibleCategories = forumCategories.filter(cat => canAccessCategory(cat));

    return (
      <View style={{flex: 1}}>
        <TopBarMenu />
        <ScrollView contentContainerStyle={styles.detailContainer}>
          <TouchableOpacity onPress={() => setCurrentScreen('home')} style={styles.backButton}><Text style={styles.backButtonText}>← TILBAGE TIL FORSIDEN</Text></TouchableOpacity>
          <Text style={styles.loginHeader}>💬 AB FAN FORUM</Text>
          <Text style={styles.loginSubheader}>Vælg en kategori og deltag i debatten.</Text>

          {visibleCategories.map((cat) => {
            const catThreads = visibleThreads.filter(t => t.categoryId === cat.id);
            const recentThreads = catThreads.slice(0, 2);
            return (
              <TouchableOpacity key={cat.id} style={styles.newsCard} onPress={() => setSelectedCategory(cat)}>
                <View style={{padding: 20}}>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5}}>
                    <Text style={{fontSize: 20, fontWeight: '900', color: '#12352A'}}>{cat.name}</Text>
                    <View style={{backgroundColor: '#12352A', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12}}><Text style={{color: '#C5A059', fontSize: 11, fontWeight: 'bold'}}>{catThreads.length} debatter</Text></View>
                  </View>
                  <Text style={{fontSize: 14, color: '#555', marginBottom: 12}}>{cat.description}</Text>

                  {recentThreads.length > 0 && (
                    <View style={{borderTopWidth: 1, borderTopColor: '#F0F0EA', paddingTop: 8, marginTop: 4}}>
                      <Text style={{fontSize: 11, fontWeight: 'bold', color: '#C5A059', textTransform: 'uppercase', marginBottom: 4}}>Seneste aktive:</Text>
                      {recentThreads.map(rt => (<Text key={rt.id} style={{fontSize: 13, color: '#333', fontWeight: '600'}} numberOfLines={1}>• {rt.title} <Text style={{fontSize: 11, color: '#888', fontWeight: 'normal'}}>({rt.authorName})</Text></Text>))}
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
          <View style={{height: 40}} />
        </ScrollView>
      </View>
    );
  }

  if (currentScreen === 'songs') {
    if (selectedSong) {
       return (
         <View style={{flex: 1}}>
            <TopBarMenu />
            <ScrollView contentContainerStyle={styles.detailContainer}>
              <TouchableOpacity onPress={() => setSelectedSong(null)} style={styles.backButton}><Text style={styles.backButtonText}>← TILBAGE TIL SANGE</Text></TouchableOpacity>
              <View style={styles.detailCard}>
                <Text style={[styles.detailTitle, {fontSize: 24, textAlign: 'center'}]}>{selectedSong.title}</Text>
                {selectedSong.melody && <Text style={{textAlign: 'center', color: '#C5A059', fontWeight: 'bold', marginBottom: 15}}>Melodi: {selectedSong.melody}</Text>}
                <Text style={{fontSize: 16, color: '#333', lineHeight: 26, fontStyle: 'italic', textAlign: 'center'}}>{selectedSong.lyrics}</Text>
                <View style={{marginTop: 30, borderTopWidth: 1, borderTopColor: '#E5E5DF', paddingTop: 15, alignItems: 'center'}}>
                   <Text style={{fontSize: 12, color: '#888', marginBottom: 10}}>Indsendt af {selectedSong.submittedBy}</Text>
                   {selectedSong.link ? (
                      <TouchableOpacity onPress={() => Linking.openURL(selectedSong.link)} style={[styles.primaryButton, {width: 'auto', paddingHorizontal: 20}]}><Text style={styles.primaryButtonText}>▶ LYT TIL SANGEN</Text></TouchableOpacity>
                   ) : null}
                </View>
              </View>
            </ScrollView>
         </View>
       )
    }

    return (
      <View style={{flex: 1}}>
        <TopBarMenu />
        <ScrollView contentContainerStyle={styles.detailContainer}>
          <TouchableOpacity onPress={() => setCurrentScreen('home')} style={styles.backButton}><Text style={styles.backButtonText}>← TILBAGE</Text></TouchableOpacity>
          <Text style={styles.loginHeader}>🎵 SANGE & TEKSTER</Text>
          <Text style={styles.loginSubheader}>Lær sangene at kende, eller indsend dine egne forslag til nye tribunesange!</Text>

          {songsList.map((song) => (
            <TouchableOpacity key={song.id} style={{backgroundColor: '#FFFFFF', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E5E5DF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}} onPress={() => setSelectedSong(song)}>
              <Text style={{fontSize: 16, fontWeight: 'bold', color: '#12352A'}}>{song.title}</Text>
              <Text style={{color: '#C5A059', fontWeight: 'bold', fontSize: 18}}>➔</Text>
            </TouchableOpacity>
          ))}

          {user ? (
            <View style={{marginTop: 20}}>
               <TouchableOpacity style={[styles.secondaryButton, {backgroundColor: '#12352A', borderColor: '#C5A059'}]} onPress={() => setShowSongForm(!showSongForm)}>
                  <Text style={{color: '#C5A059', fontWeight: 'bold'}}>{showSongForm ? '✖ LUK FORMULAR' : '➕ FORESLÅ EN NY SANG'}</Text>
               </TouchableOpacity>
               
               {showSongForm && (
                  <View style={{backgroundColor: '#FFFFFF', padding: 15, borderRadius: 10, marginTop: 15, borderWidth: 1, borderColor: '#C5A059'}}>
                    <Text style={[styles.sectionTitle, {fontSize: 14, marginTop: 0}]}>💡 Foreslå en ny sang</Text>
                    <TextInput style={styles.inputField} placeholder="Sangtitel" placeholderTextColor="#888" value={newSongTitle} onChangeText={setNewSongTitle} />
                    <TextInput style={[styles.inputField, {height: 80, textAlignVertical: 'top'}]} placeholder="Sangtekst..." placeholderTextColor="#888" multiline value={newSongLyrics} onChangeText={setNewSongLyrics} />
                    <TextInput style={styles.inputField} placeholder="Melodi (f.eks. 'Yellow Submarine')" placeholderTextColor="#888" value={newSongMelody} onChangeText={setNewSongMelody} />
                    <TextInput style={styles.inputField} placeholder="Link til YouTube/Lydfil (Valgfrit)" placeholderTextColor="#888" value={newSongLink} onChangeText={setNewSongLink} />
                    <TouchableOpacity style={styles.primaryButton} onPress={async () => { if (!newSongTitle.trim() || !newSongLyrics.trim()) return showAlert("Fejl", "Udfyld titel og sangtekst."); await db.collection('songs').add({ title: newSongTitle, lyrics: newSongLyrics, link: newSongLink.trim(), melody: newSongMelody.trim(), approved: false, submittedBy: userData?.username || 'Fan', createdAt: firebase.firestore.FieldValue.serverTimestamp() }); setNewSongTitle(''); setNewSongLyrics(''); setNewSongLink(''); setNewSongMelody(''); setShowSongForm(false); showAlert("Succes", "Forslag indsendt til godkendelse!"); }}><Text style={styles.primaryButtonText}>INDSEND TIL GODKENDELSE</Text></TouchableOpacity>
                  </View>
               )}
            </View>
          ) : (<Text style={{color: '#666', fontStyle: 'italic', textAlign: 'center', marginVertical: 20}}>Log ind for at indsende sangforslag.</Text>)}

          <View style={{height: 60}} />
        </ScrollView>
      </View>
    );
  }

  if (currentScreen === 'awayInfo') {
    useEffect(() => {
      if (user) {
        db.collection('users').doc(user.uid).update({ lastSeenAway: Date.now() }).catch(()=>{});
      }
    }, []);

    if (!canViewAwayInfo) {
      return (
        <View style={{flex: 1}}>
          <TopBarMenu />
          <ScrollView contentContainerStyle={styles.detailContainer}>
            <TouchableOpacity onPress={() => setCurrentScreen('home')} style={styles.backButton}><Text style={styles.backButtonText}>← TILBAGE</Text></TouchableOpacity>
            <Text style={styles.loginHeader}>🚌 AWAY INFO</Text>
            <View style={{backgroundColor: '#FFFFFF', padding: 30, borderRadius: 12, alignItems: 'center', marginTop: 20, borderWidth: 1, borderColor: '#E30613'}}>
              <Text style={{fontSize: 16, fontWeight: 'bold', color: '#E30613', textAlign: 'center', marginBottom: 10}}>Adgang begrænset</Text>
              <Text style={{textAlign: 'center', color: '#333'}}>Denne side er udelukkende for verificerede AB fans, redaktører og administratorer.</Text>
            </View>
          </ScrollView>
        </View>
      );
    }

    if (selectedAwayInfo) {
       const m = selectedAwayInfo.matchDetails || matchesList.find(x => x.id === selectedAwayInfo.matchId || x.homeTeam === selectedAwayInfo.opponent) || { homeTeam: selectedAwayInfo.opponent || 'Udebane', matchDate: new Date() };
       return (
         <View style={{flex: 1}}>
            <TopBarMenu />
            <ScrollView contentContainerStyle={styles.detailContainer}>
              <TouchableOpacity onPress={() => setSelectedAwayInfo(null)} style={styles.backButton}><Text style={styles.backButtonText}>← TILBAGE TIL LISTEN</Text></TouchableOpacity>
              <View style={styles.detailCard}>
                 <Text style={{fontSize: 12, fontWeight: 'bold', color: '#C5A059', textAlign: 'center', marginBottom: 5}}>{formatDanishDate(m?.matchDate)}</Text>
                 <Text style={{fontSize: 22, fontWeight: '900', color: '#12352A', textAlign: 'center', marginBottom: 15}}>{m ? `${m.homeTeam} vs AB` : (selectedAwayInfo.opponent ? `${selectedAwayInfo.opponent} vs AB` : 'Udebane')}</Text>
                 <Text style={{fontSize: 16, color: '#333', lineHeight: 26}}>{selectedAwayInfo.infoText}</Text>
              </View>
            </ScrollView>
         </View>
       )
    }

    const sortedAwayInfo = awayInfoList.map(info => { const m = matchesList.find(x => x.id === info.matchId || x.homeTeam === info.opponent); return { ...info, matchDetails: m || { homeTeam: info.opponent || 'Udebane', matchDate: new Date() } }; }).sort((a, b) => new Date(a.matchDetails.matchDate?.toString().replace(' ', 'T') || 0).getTime() - new Date(b.matchDetails.matchDate?.toString().replace(' ', 'T') || 0).getTime());
    
    return (
      <View style={{flex: 1}}>
        <TopBarMenu />
        <ScrollView contentContainerStyle={styles.detailContainer}>
          <TouchableOpacity onPress={() => setCurrentScreen('home')} style={styles.backButton}><Text style={styles.backButtonText}>← TILBAGE</Text></TouchableOpacity>
          <Text style={styles.loginHeader}>🚌 AWAY INFO</Text>
          <Text style={styles.loginSubheader}>Vælg en kamp for at se al praktisk information til AB's kommende udebaneture.</Text>
          
          {sortedAwayInfo.length === 0 ? (
            <View style={{backgroundColor: '#FFFFFF', padding: 30, borderRadius: 12, alignItems: 'center', marginTop: 20, borderWidth: 1, borderColor: '#C5A059'}}><Text style={{fontSize: 16, fontWeight: 'bold', color: '#12352A', textAlign: 'center'}}>Ingen arrangerede ture planlagt endnu.</Text></View>
          ) : (
            sortedAwayInfo.map(info => (
              <TouchableOpacity key={info.id} style={{backgroundColor: '#FFFFFF', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#C5A059', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}} onPress={() => {
                const seenAway = userData?.seenAwayIds || [];
                const updatedSeenAway = [...seenAway, info.id];
                setUserData(prev => ({ ...prev, seenAwayIds: updatedSeenAway }));
                db.collection('users').doc(user.uid).set({ seenAwayIds: firebase.firestore.FieldValue.arrayUnion(info.id) }, { merge: true }).catch(()=>{});
                setSelectedAwayInfo(info);
              }}>
                <View style={{flex: 1}}>
                  <Text style={{fontSize: 10, fontWeight: 'bold', color: '#C5A059', marginBottom: 2}}>{formatDanishDate(info.matchDetails.matchDate)}</Text>
                  <Text style={{fontSize: 16, fontWeight: '900', color: '#12352A'}}>{info.matchDetails.homeTeam} vs AB</Text>
                </View>
                <Text style={{color: '#C5A059', fontWeight: 'bold', fontSize: 18}}>➔</Text>
              </TouchableOpacity>
            ))
          )}
          <View style={{height: 40}} />
        </ScrollView>
      </View>
    );
  }

  if (currentScreen === 'newsDetail') {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
        <ScrollView contentContainerStyle={styles.detailContainer}>
          <TouchableOpacity onPress={() => setCurrentScreen('home')} style={styles.backButton}><Text style={styles.backButtonText}>← TILBAGE</Text></TouchableOpacity>
          {selectedNews && (
            <View style={styles.detailCard}>
              <Image source={{ uri: selectedNews.image }} style={styles.detailImage} />
              <Text style={styles.detailTitle}>{selectedNews.title}</Text>
              <Text style={styles.detailDate}>{selectedNews.createdAt ? formatDanishDate(selectedNews.createdAt) : selectedNews.date}</Text>
              <Text style={styles.detailBody}>{selectedNews.content}</Text>
            </View>
          )}
          <Text style={[styles.sectionTitle, {marginTop: 20}]}>Kommentarer ({visibleNewsComments.length})</Text>
          {visibleNewsComments.map((c) => {
            const commentLivePhoto = getLiveAuthorPhoto(c.authorId, c.authorPhoto);
            return (
              <View key={c.id} style={styles.commentRow}>
                <TouchableOpacity onPress={() => handleOpenProfile(c.authorId)}><Image source={{ uri: commentLivePhoto }} style={styles.commentAvatar} /></TouchableOpacity>
                <View style={{flex: 1}}>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                    <TouchableOpacity onPress={() => handleOpenProfile(c.authorId)}><Text style={styles.commentUser}>{c.authorName} <Text style={{fontSize: 9, color: '#C5A059'}}>({c.authorRole})</Text></Text></TouchableOpacity>
                    <View style={{flexDirection: 'row'}}>
                      {user && user.uid !== c.authorId && (<TouchableOpacity onPress={() => openUGCMenu('news_comment', c.id, c.authorId, c.authorName)}><Text style={{color: '#8A1C1C', fontSize: 14, marginRight: 10}}>⚠</Text></TouchableOpacity>)}
                      {(isAdmin || user?.uid === c.authorId) && (<TouchableOpacity onPress={() => Alert.alert("Slet", "Vil du slette kommentaren?", [{ text: "Annuller" }, { text: "Slet", style: "destructive", onPress: async () => await db.collection('news').doc(selectedNews.id).collection('comments').doc(c.id).delete() }])}><Text style={{color: '#8A1C1C', fontSize: 10, fontWeight: 'bold'}}>SLET</Text></TouchableOpacity>)}
                    </View>
                  </View>
                  <Text style={styles.commentText}>{c.content}</Text>
                  {c.authorSignature ? <Text style={{fontSize: 10, color: '#888', fontStyle: 'italic', marginTop: 4}}>{c.authorSignature}</Text> : null}
                </View>
              </View>
            );
          })}
          {user ? (
            <View style={styles.commentInputContainer}>
              <TextInput style={styles.commentInput} placeholder="Skriv en kommentar..." placeholderTextColor="#888" value={newNewsComment} onChangeText={newNewsComment} />
              <TouchableOpacity style={styles.commentSendBtn} onPress={async () => { if (!newNewsComment.trim() || !selectedNews) return; await db.collection('news').doc(selectedNews.id).collection('comments').add({ content: newNewsComment, authorId: user.uid, authorName: userData?.username || 'Fan', authorPhoto: userData?.photoURL || '', authorRole: isSuperAdmin ? 'Super Admin' : (userData?.role || 'Alm. Bruger'), authorFractions: userData?.hideFractions ? [] : (userData?.fractions || []), authorSignature: userData?.signature || '', createdAt: firebase.firestore.FieldValue.serverTimestamp() }); setNewNewsComment(''); }}><Text style={{color: '#FFFFFF', fontWeight: 'bold'}}>SEND</Text></TouchableOpacity>
            </View>
          ) : <Text style={{color: '#666', fontStyle: 'italic', textAlign: 'center', marginVertical: 15}}>Log ind for at kommentere.</Text>}
          <View style={{height: 60}} />
        </ScrollView>
        {renderProfileModal()}
      </KeyboardAvoidingView>
    );
  }

  if (currentScreen === 'login') {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
        <ScrollView contentContainerStyle={styles.loginScreenContainer}>
          <TouchableOpacity onPress={() => setCurrentScreen('home')} style={styles.backButton}><Text style={styles.backButtonText}>← TILBAGE</Text></TouchableOpacity>
          <Text style={styles.loginHeader}>LOG IND</Text>
          <Text style={styles.loginSubheader}>Log ind for at spille med i tipspillet og deltage i forum debatten.</Text>
          <TextInput style={styles.inputField} placeholder="E-mail" placeholderTextColor="#888" autoCapitalize="none" value={email} onChangeText={setEmail} />
          <TextInput style={styles.inputField} placeholder="Adgangskode" placeholderTextColor="#888" secureTextEntry value={password} onChangeText={setPassword} />
          <TouchableOpacity style={styles.checkboxRow} onPress={() => setRememberMe(!rememberMe)}><View style={[styles.checkboxBox, rememberMe && styles.checkboxChecked]}>{rememberMe && <Text style={{color: '#fff', fontSize: 12, fontWeight: 'bold'}}>✓</Text>}</View><Text style={styles.checkboxLabel}>Husk mig på enheden</Text></TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={async () => { if (!email || !password) return showAlert("Fejl", "Udfyld e-mail og adgangskode."); try { await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); await auth.signInWithEmailAndPassword(email, password); setCurrentScreen('home'); setEmail(''); setPassword(''); } catch (error) { showAlert("Login fejl", error.message); } }}><Text style={styles.primaryButtonText}>LOG IND</Text></TouchableOpacity>
          <TouchableOpacity style={styles.googleButton} onPress={async () => { try { const provider = new firebase.auth.GoogleAuthProvider(); await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); const result = await auth.signInWithPopup(provider); const u = result.user; const userDoc = await db.collection('users').doc(u.uid).get(); if (!userDoc.exists) { const newUserData = { uid: u.uid, username: u.displayName || 'Google Fan', email: u.email, photoURL: u.photoURL || 'https://via.placeholder.com/150', points: 0, role: u.email === 'schaldeab@gmail.com' ? 'Super Admin' : 'Alm. Bruger', fractions: [], bio: '', signature: '', hideFractions: false, banned: false, bannedUntil: null, blockedUsers: [], stats: { exactHits: 0, signHits: 0, misses: 0, doubleUpHits: 0 }, roundPoints: {}, notifPreferences: { news: true, away: true, tipspil: true, forum: true }, createdAt: firebase.firestore.FieldValue.serverTimestamp() }; await db.collection('users').doc(u.uid).set(newUserData); setUserData(newUserData); } setCurrentScreen('home'); } catch (error) { showAlert("Google login fejl", error.message); } }}><Text style={styles.googleButtonText}>🔵 LOG IND MED GOOGLE</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.secondaryButton, {marginTop: 20}]} onPress={() => setCurrentScreen('signup')}><Text style={styles.secondaryButtonText}>Har du ikke en konto? Opret her</Text></TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (currentScreen === 'signup') {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
        <ScrollView contentContainerStyle={styles.loginScreenContainer}>
          <TouchableOpacity onPress={() => setCurrentScreen('login')} style={styles.backButton}><Text style={styles.backButtonText}>← TILBAGE TIL LOG IND</Text></TouchableOpacity>
          <Text style={styles.loginHeader}>OPRET BRUGER</Text>
          <TextInput style={styles.inputField} placeholder="Brugernavn" placeholderTextColor="#888" value={username} onChangeText={setUsername} />
          <TouchableOpacity style={[styles.primaryButton, {backgroundColor: '#C5A059', marginBottom: 15}]} onPress={handlePickImage} disabled={isUploading}><Text style={[styles.primaryButtonText, {color: '#111'}]}>{isUploading ? 'UPLOADER...' : '📁 UPLOAD PROFILBILLEDTE'}</Text></TouchableOpacity>
          <TextInput style={styles.inputField} placeholder="Eller Billede URL" placeholderTextColor="#888" autoCapitalize="none" value={avatarUrl} onChangeText={setAvatarUrl} />
          <TextInput style={styles.inputField} placeholder="E-mail" placeholderTextColor="#888" autoCapitalize="none" value={email} onChangeText={setEmail} />
          <TextInput style={styles.inputField} placeholder="Adgangskode" placeholderTextColor="#888" secureTextEntry value={password} onChangeText={setPassword} />
          <TextInput style={styles.inputField} placeholder="Bekræft adgangskode" placeholderTextColor="#888" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} />
          <TouchableOpacity style={styles.primaryButton} onPress={async () => { if (!username || !email || !password || !confirmPassword) return showAlert("Fejl", "Udfyld alle felter."); if (password !== confirmPassword) return showAlert("Fejl", "Adgangskoderne er ikke ens."); setIsUploading(true); try { await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); const userCredential = await auth.createUserWithEmailAndPassword(email, password); let finalPhotoUrl = avatarUrl.trim() !== '' ? avatarUrl.trim() : `https://via.placeholder.com/150/12352A/FFFFFF?text=${username.charAt(0).toUpperCase()}`; await userCredential.user.updateProfile({ displayName: username, photoURL: finalPhotoUrl }); let assignedRole = email === 'schaldeab@gmail.com' ? 'Super Admin' : 'Alm. Bruger'; const newUserData = { uid: userCredential.user.uid, username, email, photoURL: finalPhotoUrl, points: 0, role: assignedRole, fractions: [], bio: '', signature: '', hideFractions: false, banned: false, bannedUntil: null, blockedUsers: [], stats: { exactHits: 0, signHits: 0, misses: 0, doubleUpHits: 0 }, roundPoints: {}, notifPreferences: { news: true, away: true, tipspil: true, forum: true }, createdAt: firebase.firestore.FieldValue.serverTimestamp() }; await db.collection('users').doc(userCredential.user.uid).set(newUserData); setUserData(newUserData); setCurrentScreen('home'); setUsername(''); setEmail(''); setPassword(''); setConfirmPassword(''); setAvatarUrl(''); } catch (error) { showAlert("Fejl", error.message); } finally { setIsUploading(false); } }}><Text style={styles.primaryButtonText}>OPRET</Text></TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (currentScreen === 'editProfile') {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
        <ScrollView contentContainerStyle={styles.loginScreenContainer}>
          <TouchableOpacity onPress={() => setCurrentScreen('home')} style={styles.backButton}><Text style={styles.backButtonText}>← TILBAGE</Text></TouchableOpacity>
          <Text style={styles.loginHeader}>REDIGER PROFIL</Text>
          <TextInput style={styles.inputField} placeholder="Brugernavn" value={username} onChangeText={setUsername} />
          <TouchableOpacity style={[styles.primaryButton, {backgroundColor: '#C5A059', marginBottom: 15}]} onPress={handlePickImage} disabled={isUploading}><Text style={[styles.primaryButtonText, {color: '#111'}]}>{isUploading ? 'UPLOADER...' : '📁 UPLOAD PROFILBILLEDTE'}</Text></TouchableOpacity>
          <TextInput style={styles.inputField} placeholder="Eller Billede URL" autoCapitalize="none" value={avatarUrl} onChangeText={setAvatarUrl} />
          <TextInput style={[styles.inputField, {height: 80, textAlignVertical: 'top'}]} placeholder="Om mig" multiline value={bio} onChangeText={setBio} />
          <TextInput style={styles.inputField} placeholder="Signatur (vises i bunden af indlæg)" value={signature} onChangeText={setSignature} />
          <TouchableOpacity style={[styles.checkboxRow, {marginBottom: 15}]} onPress={() => setHideFractions(!hideFractions)}><View style={[styles.checkboxBox, hideFractions && styles.checkboxChecked]}>{hideFractions && <Text style={{color: '#fff', fontSize: 12}}>✓</Text>}</View><Text style={styles.checkboxLabel}>Skjul mine fanfraktioner</Text></TouchableOpacity>

          <Text style={[styles.sectionTitle, {fontSize: 14, marginTop: 10}]}>Notifikationsindstillinger</Text>
          <TouchableOpacity style={[styles.checkboxRow, {marginBottom: 8}]} onPress={() => setNotifNews(!notifNews)}><View style={[styles.checkboxBox, notifNews && styles.checkboxChecked]}>{notifNews && <Text style={{color: '#fff', fontSize: 12}}>✓</Text>}</View><Text style={styles.checkboxLabel}>Nyheder</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.checkboxRow, {marginBottom: 8}]} onPress={() => setNotifAway(!notifAway)}><View style={[styles.checkboxBox, notifAway && styles.checkboxChecked]}>{notifAway && <Text style={{color: '#fff', fontSize: 12}}>✓</Text>}</View><Text style={styles.checkboxLabel}>Away Info</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.checkboxRow, {marginBottom: 8}]} onPress={() => setNotifTipspil(!notifTipspil)}><View style={[styles.checkboxBox, notifTipspil && styles.checkboxChecked]}>{notifTipspil && <Text style={{color: '#fff', fontSize: 12}}>✓</Text>}</View><Text style={styles.checkboxLabel}>Tipspil Point</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.checkboxRow, {marginBottom: 20}]} onPress={() => setNotifForum(!notifForum)}><View style={[styles.checkboxBox, notifForum && styles.checkboxChecked]}>{notifForum && <Text style={{color: '#fff', fontSize: 12}}>✓</Text>}</View><Text style={styles.checkboxLabel}>Forum Svar</Text></TouchableOpacity>
          
          <TouchableOpacity style={styles.primaryButton} onPress={async () => { if (!username) return showAlert("Fejl", "Brugernavn påkrævet."); setIsUploading(true); try { const currentUser = auth.currentUser; let finalPhotoUrl = avatarUrl.trim() !== '' ? avatarUrl.trim() : currentUser.photoURL; await currentUser.updateProfile({ displayName: username, photoURL: finalPhotoUrl }); const newPrefs = { news: notifNews, away: notifAway, tipspil: notifTipspil, forum: notifForum }; await db.collection('users').doc(currentUser.uid).set({ uid: currentUser.uid, username, photoURL: finalPhotoUrl, bio, signature, hideFractions, notifPreferences: newPrefs }, { merge: true }); setUserData({ ...userData, username, photoURL: finalPhotoUrl, bio, signature, hideFractions, notifPreferences: newPrefs }); setCurrentScreen('home'); showAlert("Succes", "Profil opdateret!"); } catch (error) { showAlert("Fejl", error.message); } finally { setIsUploading(false); } }}><Text style={styles.primaryButtonText}>GEM ÆNDRINGER</Text></TouchableOpacity>
          <View style={{height: 40}} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return null;
}
