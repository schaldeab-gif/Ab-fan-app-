import React, { useState, useEffect } from 'react';
import { SafeAreaView, StatusBar, Alert, View, TouchableOpacity, Text } from 'react-native';
import { AppContext } from './AppContext';
import firebase from 'firebase';
import { auth, db } from './FirebaseConfig';
import { styles } from './styles';
import { INITIAL_TEAM_DB } from './teamDatabase';

import ClientScreens from './ClientScreens';
import AdminScreens from './AdminScreens';
import { Video, Audio, ResizeMode } from 'expo-av';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [isVideoMuted, setIsVideoMuted] = useState(true);
  const [currentScreen, setCurrentScreen] = useState('home');
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [appSettings, setAppSettings] = useState({ maintenanceMode: false, forumLocked: false });

  // Globale lister
  const [newsList, setNewsList] = useState([]);
  const [rssNews, setRssNews] = useState([]);
  const [matchesList, setMatchesList] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [songsList, setSongsList] = useState([]);
  const [pendingSongs, setPendingSongs] = useState([]);
  const [allFractions, setAllFractions] = useState([]);
  const [awayInfoList, setAwayInfoList] = useState([]);
  const [forumCategories, setForumCategories] = useState([]);
  const [allThreads, setAllThreads] = useState([]);
  const [rssFeedsList, setRssFeedsList] = useState([]);
  const [customTeams, setCustomTeams] = useState({});
  const [userPredictions, setUserPredictions] = useState({});
  
  const [viewingProfileUser, setViewingProfileUser] = useState(null);
  const [upcomingFilter, setUpcomingFilter] = useState('All');

  useEffect(() => {
    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: false,
        });
      } catch (e) {}
    };
    setupAudio();
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const userDoc = await db.collection('users').doc(currentUser.uid).get();
          if (userDoc.exists) setUserData(userDoc.data());
          const predDoc = await db.collection('users').doc(currentUser.uid).collection('predictions').doc('current').get();
          if (predDoc.exists) setUserPredictions(predDoc.data());
        } catch (error) {}
      } else {
        setUser(null); setUserData(null); setUserPredictions({});
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    db.collection('app_config').doc('settings').onSnapshot((doc) => { if(doc.exists) setAppSettings(doc.data()); });
    db.collection('news').orderBy('createdAt', 'desc').onSnapshot(snap => setNewsList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    db.collection('matches').orderBy('matchDate', 'asc').onSnapshot(snap => setMatchesList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    db.collection('users').orderBy('points', 'desc').onSnapshot(snap => setLeaderboard(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    db.collection('users').onSnapshot(snap => setUsersList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    db.collection('audit_logs').orderBy('createdAt', 'desc').limit(50).onSnapshot(snap => setAuditLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    db.collection('songs').where('approved', '==', true).onSnapshot(snap => setSongsList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    db.collection('songs').where('approved', '==', false).onSnapshot(snap => setPendingSongs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    db.collection('fractions').onSnapshot(snap => setAllFractions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    db.collection('custom_teams').onSnapshot(snap => { const fetched = {}; snap.docs.forEach(doc => { fetched[doc.data().name] = doc.data(); }); setCustomTeams(fetched); });
    
    db.collection('forum_categories').onSnapshot(async (snap) => {
      if (snap.empty) {
        const defaults = [{ name: 'AB Generelt', desc: 'Alt om Akademisk Boldklub' }, { name: 'Kamp tråde', desc: 'Diskussion før og efter kampene' }];
        for (let d of defaults) await db.collection('forum_categories').add({ name: d.name, description: d.desc, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      } else setForumCategories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    db.collection('forum_threads').onSnapshot(snap => {
      const threadsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      threadsData.sort((a, b) => (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0) - (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0));
      setAllThreads(threadsData);
    });

    db.collection('rss_feeds').onSnapshot(async (snap) => {
      let feeds = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRssFeedsList(feeds);
      if (feeds.length === 0) return;
      let allRssItems = [];
      for (let f of feeds) {
        try {
          const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(f.url)}`;
          const res = await fetch(apiUrl); const data = await res.json();
          if (data && data.status === 'ok' && data.items) {
            const abItems = data.items.filter(item => { const combined = (item.title + ' ' + item.description + ' ' + item.content).toLowerCase(); return (/\bab\b/i.test(combined) || combined.includes('akademisk boldklub')); });
            allRssItems = [...allRssItems, ...abItems.map(item => ({ title: item.title, link: item.link, pubDate: item.pubDate, sourceName: f.name }))];
          }
        } catch (err) {}
      }
      allRssItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
      setRssNews(allRssItems.slice(0, 10));
    });
  }, []);

  useEffect(() => {
    if (!user) {
      setAwayInfoList([]);
      return;
    }
    const unsubAway = db.collection('away_info').onSnapshot(snap => {
      setAwayInfoList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, error => {});
    return () => unsubAway();
  }, [user]);

  const formatDanishDate = (dateInput) => {
    if (!dateInput) return ''; let d;
    if (dateInput.toDate) d = dateInput.toDate();
    else if (typeof dateInput === 'string') { const isMatchFormat = dateInput.includes(' ') && !dateInput.includes('T'); d = new Date(isMatchFormat ? dateInput.replace(' ', 'T') : dateInput); }
    else d = new Date(dateInput);
    if (isNaN(d.getTime())) return dateInput;
    const days = ['Søn.', 'Man.', 'Tir.', 'Ons.', 'Tor.', 'Fre.', 'Lør.']; const months = ['Januar', 'Februar', 'Marts', 'April', 'Maj', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'December'];
    return `${days[d.getDay()]} ${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()} kl. ${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const getTeamStyle = (teamName) => ({ ...INITIAL_TEAM_DB, ...customTeams })[teamName] || { backgroundColor: '#12352A', color: '#FFFFFF' };
  const getTeamLogo = (teamName) => ({ ...INITIAL_TEAM_DB, ...customTeams })[teamName]?.logo || 'https://via.placeholder.com/150';
  const getStadium = (homeTeam) => ({ ...INITIAL_TEAM_DB, ...customTeams })[homeTeam]?.stadium || 'Ukendt Stadion';
  const isMatchLocked = (matchDateStr) => matchDateStr && new Date().getTime() >= (new Date(matchDateStr.replace(' ', 'T')).getTime() - (5 * 60 * 1000));
  
  const getNextAbMatch = () => {
    const matchEndEstimate = new Date().getTime() - (2 * 60 * 60 * 1000);
    const abMatches = matchesList.filter(m => (m.homeTeam === 'AB' || m.awayTeam === 'AB') && !m.finalScore && m.matchDate && new Date(m.matchDate.replace(' ', 'T')).getTime() > matchEndEstimate);
    abMatches.sort((a, b) => new Date(a.matchDate.replace(' ', 'T')).getTime() - new Date(b.matchDate.replace(' ', 'T')).getTime());
    return abMatches[0] || null;
  };
  const nextMatch = getNextAbMatch();

  const getUpcomingMatches = () => {
    const matchEndEstimate = new Date().getTime() - (2 * 60 * 60 * 1000);
    let upcoming = matchesList.filter(m => (m.homeTeam === 'AB' || m.awayTeam === 'AB') && !m.finalScore && m.matchDate && new Date(m.matchDate.replace(' ', 'T')).getTime() > matchEndEstimate);
    if (nextMatch) upcoming = upcoming.filter(m => m.id !== nextMatch.id);
    if (upcomingFilter === 'Home') upcoming = upcoming.filter(m => m.homeTeam === 'AB');
    if (upcomingFilter === 'Away') upcoming = upcoming.filter(m => m.awayTeam === 'AB');
    return upcoming.sort((a, b) => new Date(a.matchDate.replace(' ', 'T')).getTime() - new Date(b.matchDate.replace(' ', 'T')).getTime()).slice(0, 5);
  };
  const upcomingMatchesToDisplay = getUpcomingMatches();

  const handleManualRefresh = () => {
    Alert.alert("Opdateret", "Sidste nye data er hentet!");
  };

  const logActivity = async (category, message, authorName) => {
    try { await db.collection('audit_logs').add({ category, message, username: authorName || 'System', createdAt: firebase.firestore.FieldValue.serverTimestamp() }); } catch (e) {}
  };

  const contextValue = {
    appSettings, setAppSettings, user, setUser, userData, setUserData, currentScreen, setCurrentScreen,
    menuOpen, setMenuOpen, newsList, rssNews, matchesList, leaderboard, usersList, auditLogs, songsList,
    pendingSongs, allFractions, awayInfoList, forumCategories, allThreads, rssFeedsList, customTeams,
    userPredictions, setUserPredictions, viewingProfileUser, setViewingProfileUser, upcomingFilter, setUpcomingFilter,
    formatDanishDate, getTeamStyle, getTeamLogo, getStadium, isMatchLocked, nextMatch, upcomingMatchesToDisplay, handleManualRefresh, logActivity
  };

  if (showSplash) {
    return (
      <SafeAreaView style={[styles.container, { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#12352A' }]}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <TouchableOpacity style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', padding: 15 }} activeOpacity={1} onPress={() => setShowSplash(false)}>
          
          {/* SKUDSIKKER BOKS MED OFFICIELL RESIZEMODE.CONTAIN */}
          <View style={{ width: '75%', maxWidth: 300, aspectRatio: 9/16, justifyContent: 'center', alignItems: 'center', borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: '#C5A059', backgroundColor: '#000', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.6, shadowRadius: 15, elevation: 12 }}>
            <Video 
              source={{ uri: 'https://res.cloudinary.com/p8m3uw3r/video/upload/gemini_generated_video_4c34e273_1_jeodgc.mp4' }} 
              style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
              resizeMode={ResizeMode.CONTAIN} 
              shouldPlay={true} 
              isMuted={isVideoMuted}
              isLooping={false} 
              onPlaybackStatusUpdate={(status) => { if (status.didJustFinish) setShowSplash(false); }} 
            />
          </View>

          <TouchableOpacity 
            onPress={() => setIsVideoMuted(!isVideoMuted)} 
            style={{ marginTop: 20, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#0B221B', borderRadius: 20, borderWidth: 1, borderColor: '#C5A059' }}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>{isVideoMuted ? '🔇 Tænd Lyd' : '🔊 Sluk Lyd'}</Text>
          </TouchableOpacity>
          <Text style={{ color: '#C5A059', marginTop: 15, fontWeight: 'bold', letterSpacing: 2, textAlign: 'center', fontSize: 13 }}>TRYK HER FOR AT STARTE APPEN</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isAdminScreen = currentScreen.startsWith('admin') || currentScreen === 'auditLog';

  return (
    <AppContext.Provider value={contextValue}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#12352A" />
        {isAdminScreen ? <AdminScreens /> : <ClientScreens />}
      </SafeAreaView>
    </AppContext.Provider>
  );
}
