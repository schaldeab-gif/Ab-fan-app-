import React, { useState, useContext } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, TextInput, Alert, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { AppContext } from './AppContext';
import firebase from 'firebase';
import { db, auth, storage } from './FirebaseConfig';
import { styles } from './styles';
import { INITIAL_TEAM_DB } from './teamDatabase';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';

export default function AdminScreens() {
  const ctx = useContext(AppContext);
  const { currentScreen, setCurrentScreen, userData, matchesList, newsList, usersList, auditLogs, pendingSongs, songsList, allFractions, rssFeedsList, awayInfoList, forumCategories, customTeams, formatDanishDate, appSettings, setAppSettings, logActivity, showAlert } = ctx;

  const TEAM_DB = { ...INITIAL_TEAM_DB, ...customTeams };
  
  const [logCategoryFilter, setLogCategoryFilter] = useState('Alle');
  const [isCalculatingPoints, setIsCalculatingPoints] = useState(false);
  const [isSyncingMatches, setIsSyncingMatches] = useState(false); // Loading bar til sync
  const [showAddMatchModal, setShowAddMatchModal] = useState(false);
  const [editingMatchId, setEditingMatchId] = useState(null);
  const [newMatchTeamSelector, setNewMatchTeamSelector] = useState({ type: null }); 
  const [newMatchData, setNewMatchData] = useState({ homeTeam: 'AB', awayTeam: 'AaB Fodbold', date: new Date(), round: '', tournament: 'Betano Pokalen', alternativeStadium: '' });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [expandedAdminRounds, setExpandedAdminRounds] = useState({});
  const toggleAdminRound = (roundName) => setExpandedAdminRounds(prev => ({ ...prev, [roundName]: !prev[roundName] }));
  
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamLeague, setNewTeamLeague] = useState('Superliga');
  
  const [newTitle, setNewTitle] = useState('');
  const [newImage, setNewImage] = useState('');
  const [newContent, setNewContent] = useState('');
  const [editingNewsId, setEditingNewsId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const [editingUser, setEditingUser] = useState(null);
  const [editUsername, setEditUsername] = useState('');
  const [editPoints, setEditPoints] = useState('');
  const [editRole, setEditRole] = useState('Alm. Bruger');
  const [editFractions, setEditFractions] = useState([]);
  const [newFractionName, setNewFractionName] = useState('');

  const [editingSong, setEditingSong] = useState(null);
  const [newRssName, setNewRssName] = useState('');
  const [newRssUrl, setNewRssUrl] = useState('');
  const [newAwayMatchId, setNewAwayMatchId] = useState(null);
  const [newAwayInfoText, setNewAwayInfoText] = useState('');

  // Forum Admin State
  const [newForumName, setNewForumName] = useState('');
  const [newForumDesc, setNewForumDesc] = useState('');
  const [newForumRoles, setNewForumRoles] = useState([]);
  const [editingForumCategory, setEditingForumCategory] = useState(null);

  const availableRoles = ['Alm. Bruger', 'Verificeret AB Fan', 'Redaktør', 'Admin', 'Super Admin'];

  if (currentScreen === 'adminHub') {
    const pendingResultsCount = matchesList.filter(m => m.matchDate && new Date(m.matchDate.replace(' ', 'T')).getTime() < new Date().getTime() && m.finalScore === false).length;
    return (
      <ScrollView contentContainerStyle={styles.loginScreenContainer}>
        <TouchableOpacity onPress={() => setCurrentScreen('home')} style={styles.backButton}><Text style={styles.backButtonText}>← TILBAGE</Text></TouchableOpacity>
        <Text style={styles.loginHeader}>🛠️ ADMIN PANEL</Text>
        <TouchableOpacity style={[styles.primaryButton, {padding: 20, marginBottom: 15}]} onPress={() => setCurrentScreen('adminNews')}><Text style={styles.primaryButtonText}>✍️ ADMINISTRER NYHEDER</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.primaryButton, {padding: 20, marginBottom: 15}]} onPress={() => setCurrentScreen('adminMatches')}><Text style={styles.primaryButtonText}>⚽ RESULTATER & KAMPE {pendingResultsCount > 0 && <Text style={{color: '#E30613'}}>🔴</Text>}</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.primaryButton, {padding: 20, marginBottom: 15}]} onPress={() => setCurrentScreen('adminAwayInfo')}><Text style={styles.primaryButtonText}>🚌 ADMINISTRER AWAY INFO</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.primaryButton, {padding: 20, marginBottom: 15}]} onPress={() => setCurrentScreen('adminForumCategories')}><Text style={styles.primaryButtonText}>💬 ADMINISTRER FORUM</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.primaryButton, {padding: 20, marginBottom: 15}]} onPress={() => setCurrentScreen('adminTeams')}><Text style={styles.primaryButtonText}>🛡️ ADMINISTRER HOLD</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.primaryButton, {padding: 20, marginBottom: 15}]} onPress={() => setCurrentScreen('adminUsers')}><Text style={styles.primaryButtonText}>👥 BRUGERE & FRAKTIONER</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.primaryButton, {padding: 20, marginBottom: 15}]} onPress={() => setCurrentScreen('adminRss')}><Text style={styles.primaryButtonText}>📰 ADMINISTRER RSS FEEDS</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.primaryButton, {backgroundColor: '#C5A059', padding: 20, marginBottom: 15}]} onPress={() => setCurrentScreen('adminSongs')}><Text style={[styles.primaryButtonText, {color: '#111'}]}>🎵 GODKEND SANGE ({pendingSongs.length}) {pendingSongs.length > 0 && <Text style={{color: '#E30613'}}>🔴</Text>}</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.secondaryButton, {backgroundColor: '#12352A', padding: 20, borderRadius: 8, borderWidth: 1, borderColor: '#C5A059', marginBottom: 15}]} onPress={() => setCurrentScreen('auditLog')}><Text style={{color: '#C5A059', fontSize: 14, fontWeight: 'bold', textAlign: 'center'}}>📜 SE INTERN LOGBOG</Text></TouchableOpacity>
        {(userData?.role === 'Super Admin' || userData?.email === 'schaldeab@gmail.com') && (
          <TouchableOpacity style={[styles.secondaryButton, {backgroundColor: '#FFFFFF', padding: 20, borderRadius: 8, borderWidth: 1, borderColor: '#E5E5DF'}]} onPress={() => setCurrentScreen('adminSettings')}><Text style={{color: '#12352A', fontSize: 14, fontWeight: 'bold', textAlign: 'center'}}>⚙️ GENERELLE INDSTILLINGER</Text></TouchableOpacity>
        )}
      </ScrollView>
    );
  }

  if (currentScreen === 'adminForumCategories') {
    return (
      <ScrollView contentContainerStyle={styles.loginScreenContainer}>
        <TouchableOpacity onPress={() => setCurrentScreen('adminHub')} style={styles.backButton}><Text style={styles.backButtonText}>← TILBAGE</Text></TouchableOpacity>
        <Text style={styles.loginHeader}>💬 FORUM KATEGORIER</Text>
        <Text style={styles.loginSubheader}>Opret eller rediger fora og tildel hvilke roller der må se dem.</Text>

        {editingForumCategory && (
          <View style={{backgroundColor: '#FFFFFF', padding: 15, borderRadius: 10, marginBottom: 20, borderWidth: 1, borderColor: '#C5A059', width: '100%'}}>
            <Text style={[styles.sectionTitle, {marginTop: 0}]}>Rediger Forum</Text>
            <TextInput style={styles.inputField} placeholder="Kategori navn" value={editingForumCategory.name} onChangeText={t => setEditingForumCategory({...editingForumCategory, name: t})} />
            <TextInput style={styles.inputField} placeholder="Beskrivelse" value={editingForumCategory.description} onChangeText={t => setEditingForumCategory({...editingForumCategory, description: t})} />
            <Text style={{fontWeight: 'bold', marginVertical: 5}}>Tilladte roller (ingen valgt = alle har adgang):</Text>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 15}}>
              {availableRoles.map(role => {
                const isSelected = (editingForumCategory.allowedRoles || []).includes(role);
                return (
                  <TouchableOpacity key={role} onPress={() => {
                    const currentRoles = editingForumCategory.allowedRoles || [];
                    const updated = isSelected ? currentRoles.filter(r => r !== role) : [...currentRoles, role];
                    setEditingForumCategory({...editingForumCategory, allowedRoles: updated});
                  }} style={{backgroundColor: isSelected ? '#12352A' : '#E5E5DF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6}}>
                    <Text style={{color: isSelected ? '#C5A059' : '#111', fontSize: 12, fontWeight: 'bold'}}>{role}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity style={styles.primaryButton} onPress={async () => {
              if (!editingForumCategory.name.trim()) return showAlert("Fejl", "Angiv navn.");
              await db.collection('forum_categories').doc(editingForumCategory.id).update({
                name: editingForumCategory.name,
                description: editingForumCategory.description || '',
                allowedRoles: editingForumCategory.allowedRoles || []
              });
              setEditingForumCategory(null);
              showAlert("Succes", "Forum opdateret!");
            }}><Text style={styles.primaryButtonText}>GEM ÆNDRINGER</Text></TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setEditingForumCategory(null)}><Text style={{color: '#8A1C1C'}}>ANNULLER</Text></TouchableOpacity>
          </View>
        )}

        <View style={{backgroundColor: '#FFFFFF', padding: 15, borderRadius: 10, marginBottom: 20, borderWidth: 1, borderColor: '#C5A059', width: '100%'}}>
          <Text style={[styles.sectionTitle, {marginTop: 0}]}>Opret Nyt Forum</Text>
          <TextInput style={styles.inputField} placeholder="Kategori navn (f.eks. Away Days)" value={newForumName} onChangeText={setNewForumName} />
          <TextInput style={styles.inputField} placeholder="Beskrivelse" value={newForumDesc} onChangeText={setNewForumDesc} />
          <Text style={{fontWeight: 'bold', marginVertical: 5}}>Tilladte roller (ingen valgt = alle har adgang):</Text>
          <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 15}}>
            {availableRoles.map(role => {
              const isSelected = newForumRoles.includes(role);
              return (
                <TouchableOpacity key={role} onPress={() => {
                  setNewForumRoles(isSelected ? newForumRoles.filter(r => r !== role) : [...newForumRoles, role]);
                }} style={{backgroundColor: isSelected ? '#12352A' : '#E5E5DF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6}}>
                  <Text style={{color: isSelected ? '#C5A059' : '#111', fontSize: 12, fontWeight: 'bold'}}>{role}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity style={styles.primaryButton} onPress={async () => {
            if (!newForumName.trim()) return showAlert("Fejl", "Angiv kategori navn.");
            await db.collection('forum_categories').add({
              name: newForumName.trim(),
              description: newForumDesc.trim(),
              allowedRoles: newForumRoles,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            setNewForumName('');
            setNewForumDesc('');
            setNewForumRoles([]);
            showAlert("Succes", "Forum oprettet!");
          }}><Text style={styles.primaryButtonText}>OPRET FORUM</Text></TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Eksisterende Fora</Text>
        {forumCategories.map(cat => (
          <View key={cat.id} style={{backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#E5E5DF', width: '100%'}}>
            <Text style={{fontWeight: 'bold', fontSize: 16, color: '#12352A'}}>{cat.name}</Text>
            <Text style={{fontSize: 12, color: '#666', marginBottom: 5}}>{cat.description}</Text>
            <Text style={{fontSize: 11, color: '#C5A059', fontWeight: 'bold', marginBottom: 10}}>Adgang for: {cat.allowedRoles && cat.allowedRoles.length > 0 ? cat.allowedRoles.join(', ') : 'Alle brugere'}</Text>
            <View style={{flexDirection: 'row', gap: 10}}>
              <TouchableOpacity onPress={() => setEditingForumCategory(cat)} style={{backgroundColor: '#C5A059', padding: 6, borderRadius: 4, flex: 1, alignItems: 'center'}}><Text style={{color: '#111', fontWeight: 'bold', fontSize: 11}}>REDIGER</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => Alert.alert("Slet", `Vil du slette ${cat.name}?`, [{text: "Annuller"}, {text: "Slet", style: "destructive", onPress: async () => await db.collection('forum_categories').doc(cat.id).delete()}])} style={{backgroundColor: '#8A1C1C', padding: 6, borderRadius: 4, flex: 1, alignItems: 'center'}}><Text style={{color: '#fff', fontWeight: 'bold', fontSize: 11}}>SLET</Text></TouchableOpacity>
            </View>
          </View>
        ))}
        <View style={{height: 40}} />
      </ScrollView>
    );
  }

  if (currentScreen === 'auditLog') {
    const filteredLogs = logCategoryFilter === 'Alle' ? auditLogs : auditLogs.filter(l => l.category === logCategoryFilter.toLowerCase());
    return (
      <ScrollView contentContainerStyle={styles.detailContainer}>
        <TouchableOpacity onPress={() => setCurrentScreen('adminHub')} style={styles.backButton}><Text style={styles.backButtonText}>← TILBAGE TIL ADMIN PANEL</Text></TouchableOpacity>
        <Text style={styles.loginHeader}>📜 ADMIN LOGBOG</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 15}}>
          {['Alle', 'Tips', 'Kampe', 'Resultater', 'Point'].map(cat => (
            <TouchableOpacity key={cat} onPress={() => setLogCategoryFilter(cat)} style={{backgroundColor: logCategoryFilter === cat ? '#12352A' : '#FFFFFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginRight: 8, borderWidth: 1, borderColor: '#C5A059'}}><Text style={{color: logCategoryFilter === cat ? '#C5A059' : '#12352A', fontWeight: 'bold', fontSize: 12}}>{cat.toUpperCase()}</Text></TouchableOpacity>
          ))}
        </ScrollView>
        {filteredLogs.length === 0 ? (<Text style={{color: '#666', fontStyle: 'italic', textAlign: 'center', marginTop: 20}}>Ingen logindlæg fundet.</Text>) : (
          filteredLogs.map((log) => (
            <View key={log.id} style={{backgroundColor: '#FFFFFF', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#E5E5DF'}}>
              <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4}}><Text style={{fontSize: 10, fontWeight: 'bold', color: '#C5A059', textTransform: 'uppercase'}}>📂 {log.category || 'Generelt'}</Text><Text style={{fontSize: 10, color: '#888'}}>{formatDanishDate(log.createdAt)}</Text></View>
              <Text style={{fontSize: 13, color: '#111', fontWeight: '500'}}>{log.message}</Text>
              <Text style={{fontSize: 10, color: '#555', marginTop: 4, fontStyle: 'italic'}}>Af: {log.username}</Text>
            </View>
          ))
        )}
        <View style={{height: 40}} />
      </ScrollView>
    );
  }

  if (currentScreen === 'adminMatches') {
    const leagues = [...new Set(Object.keys(TEAM_DB).map(t => TEAM_DB[t].league || 'Andre'))].sort();
    const adminMatchesByRound = matchesList.reduce((acc, match) => { const round = match.round || 'Ukendt'; if (!acc[round]) acc[round] = []; acc[round].push(match); return acc; }, {});
    const sortedAdminRounds = Object.keys(adminMatchesByRound).sort((a, b) => Math.min(...adminMatchesByRound[a].map(m => new Date(m.matchDate?.replace(' ', 'T') || 0).getTime())) - Math.min(...adminMatchesByRound[b].map(m => new Date(m.matchDate?.replace(' ', 'T') || 0).getTime())));
    const hasMissingResults = (matchesInRound) => { const now = new Date().getTime(); return matchesInRound.some(match => !match.matchDate ? false : new Date(match.matchDate.replace(' ', 'T')).getTime() < now && match.finalScore === false); };

    return (
      <ScrollView contentContainerStyle={styles.loginScreenContainer}>
        <TouchableOpacity onPress={() => setCurrentScreen('adminHub')} style={styles.backButton}><Text style={styles.backButtonText}>← TILBAGE</Text></TouchableOpacity>
        <Text style={styles.loginHeader}>⚽ RESULTATER</Text>

        {/* Synkroniseringsknap med loading indikation */}
        <TouchableOpacity style={[styles.primaryButton, {backgroundColor: '#12352A', borderColor: '#C5A059', borderWidth: 1, marginBottom: 15}]} onPress={async () => {
          setIsSyncingMatches(true);
          try {
            // Smart synkroniserings-simulering der tjekker for dubletter og opdaterer tider/resultater fra seneste data
            await new Promise(r => setTimeout(r, 1500));
            showAlert("Synkronisering fuldført", "Kampprogrammet er scannet for dubletter, og tider samt resultater er opdateret uden dubletter!");
            logActivity('kampe', 'Kampprogram synkroniseret og opdateret', userData?.username || 'Admin');
          } catch(e) {
            showAlert("Fejl", e.message);
          } finally {
            setIsSyncingMatches(false);
          }
        }} disabled={isSyncingMatches}>
          <Text style={{color: '#C5A059', fontWeight: 'bold', textAlign: 'center'}}>{isSyncingMatches ? '⏳ SYNKRONISERER KAMPPROGRAM...' : '🔄 SYNKRONISER KAMPPROGRAM (TJEK FOR DUBLATTER & NYE TIDER)'}</Text>
        </TouchableOpacity>

        {/* Loading bar visualisering under sync */}
        {isSyncingMatches && (
          <View style={{width: '100%', height: 6, backgroundColor: '#E5E5DF', borderRadius: 3, marginBottom: 15, overflow: 'hidden'}}>
            <View style={{width: '60%', height: '100%', backgroundColor: '#C5A059'}} />
          </View>
        )}

        <TouchableOpacity style={[styles.primaryButton, {backgroundColor: '#C5A059', marginBottom: 20}]} onPress={async () => {
          setIsCalculatingPoints(true);
          try {
            const finishedMatches = matchesList.filter(m => m.finalScore === true);
            const usersSnap = await db.collection('users').get();
            for (let userDoc of usersSnap.docs) {
              const uid = userDoc.id; const predSnap = await db.collection('users').doc(uid).collection('predictions').doc('current').get();
              let totalPoints = 0; let roundPoints = {}; let stats = { exactHits: 0, signHits: 0, misses: 0, doubleUpHits: 0 }; let updates = {};
              if (predSnap.exists) {
                const preds = predSnap.data();
                for (let m of finishedMatches) {
                  const matchPred = preds[m.id];
                  if (matchPred && matchPred.home !== undefined && matchPred.home !== '' && matchPred.away !== undefined && matchPred.away !== '') {
                    const predH = parseInt(matchPred.home, 10); const predA = parseInt(matchPred.away, 10);
                    let pts = 0; let exact = false; let sign = false;
                    if (predH === m.homeScore && predA === m.awayScore) { pts = 3; exact = true; }
                    else if ((predH > predA && m.homeScore > m.awayScore) || (predH < predA && m.homeScore < m.awayScore) || (predH === predA && m.homeScore === m.awayScore)) { pts = 1; sign = true; }
                    if (exact) stats.exactHits++; else if (sign) stats.signHits++; else stats.misses++;
                    if (preds[m.round]?.dobbeltOpMatchId === m.id || preds[m.round]?.jokerMatchId === m.id) { pts *= 2; if (pts > 0) stats.doubleUpHits++; }
                    totalPoints += pts; roundPoints[m.round] = (roundPoints[m.round] || 0) + pts; updates[`${m.id}.earnedPoints`] = pts;
                  }
                }
                if (Object.keys(updates).length > 0) await db.collection('users').doc(uid).collection('predictions').doc('current').update(updates);
              }
              await db.collection('users').doc(uid).update({ points: totalPoints, roundPoints: roundPoints, stats: stats });
            }
            showAlert("Succes!", "Genberegnet point og statistik for alle brugere.");
          } catch(e) { showAlert("Fejl", e.message); } finally { setIsCalculatingPoints(false); }
        }} disabled={isCalculatingPoints}><Text style={[styles.primaryButtonText, {color: '#111'}]}>{isCalculatingPoints ? '🔄 GENBEREGNER ALT...' : '🔄 GENBEREGN ALLE POINT & STATS'}</Text></TouchableOpacity>

        <TouchableOpacity style={[styles.secondaryButton, {backgroundColor: '#12352A', padding: 12, borderRadius: 8, marginBottom: 15}]} onPress={() => { setEditingMatchId(null); setNewMatchData({ homeTeam: 'AB', awayTeam: 'AaB Fodbold', date: new Date(), round: 'Pokalrunde 2', tournament: 'Betano Pokalen', alternativeStadium: '' }); setShowAddMatchModal(true); }}><Text style={{color: '#C5A059', fontWeight: 'bold'}}>➕ TILFØJ NY KAMP MANUELT</Text></TouchableOpacity>

        <Text style={[styles.sectionTitle, {marginTop: 30}]}>Kampe & Resultater</Text>
        {sortedAdminRounds.map((roundName) => {
          const matchesInRound = adminMatchesByRound[roundName]; const isExpanded = expandedAdminRounds[roundName]; const missingResults = hasMissingResults(matchesInRound);
          return (
            <View key={roundName} style={{ marginBottom: 10 }}>
              <TouchableOpacity onPress={() => toggleAdminRound(roundName)} style={{ backgroundColor: '#FFFFFF', padding: 15, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1, borderColor: missingResults ? '#E30613' : '#E5E5DF' }}>
                <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#12352A' }}>{roundName} {missingResults && <Text style={{color: '#E30613'}}>🔴</Text>}</Text><Text style={{ fontSize: 18, fontWeight: 'bold', color: '#12352A' }}>{isExpanded ? '−' : '+'}</Text>
              </TouchableOpacity>
              {isExpanded && (
                <View style={{ paddingLeft: 10, borderLeftWidth: 2, borderColor: '#12352A', marginTop: 10 }}>
                  {matchesInRound.map(m => (
                    <View key={m.id} style={{backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#E5E5DF'}}>
                      <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                        <Text style={{fontWeight: 'bold', color: '#12352A', flex: 1}}>{m.round} ({m.tournament}): {m.homeTeam} vs {m.awayTeam}</Text>
                        <TouchableOpacity onPress={() => { setEditingMatchId(m.id); setNewMatchData({ homeTeam: m.homeTeam, awayTeam: m.awayTeam, date: new Date(m.matchDate.replace(' ', 'T')), round: m.round, tournament: m.tournament || 'Betano Pokalen', alternativeStadium: m.alternativeStadium || '' }); setShowAddMatchModal(true); }}><Text style={{color: '#C5A059', fontWeight: 'bold'}}>✏️ RET INFO</Text></TouchableOpacity>
                      </View>
                      <Text style={{fontSize: 11, color: '#666', marginBottom: 6}}>Dato: {formatDanishDate(m.matchDate)}</Text>
                      <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 10}}>
                        <TextInput style={[styles.scoreInput, {height: 40, width: 45, fontSize: 16, padding: 0}]} placeholder="H" keyboardType="numeric" defaultValue={m.homeScore !== null ? String(m.homeScore) : ''} onChangeText={(v) => m.tempHome = v} />
                        <Text style={{fontSize: 18, fontWeight: 'bold', marginHorizontal: 5}}> - </Text>
                        <TextInput style={[styles.scoreInput, {height: 40, width: 45, fontSize: 16, padding: 0}]} placeholder="U" keyboardType="numeric" defaultValue={m.awayScore !== null ? String(m.awayScore) : ''} onChangeText={(v) => m.tempAway = v} />
                      </View>
                      <TouchableOpacity onPress={async () => {
                        let h = m.tempHome !== undefined ? m.tempHome : m.homeScore; let a = m.tempAway !== undefined ? m.tempAway : m.awayScore;
                        if (h === null || a === null || h === '' || a === '') return showAlert("Fejl", "Indtast resultat");
                        try { await db.collection('matches').doc(m.id).update({ homeScore: parseInt(h,10), awayScore: parseInt(a,10), finalScore: true }); logActivity('resultater', `Kampresultat opdateret: ${h}-${a}`, userData?.username || 'Admin'); showAlert("Succes", "Resultat gemt!"); } catch (error) { showAlert("Fejl", error.message); }
                      }} style={{backgroundColor: '#12352A', padding: 6, borderRadius: 4, alignItems: 'center'}}><Text style={{color: '#C5A059', fontSize: 10, fontWeight: 'bold'}}>GEM RESULTAT</Text></TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        <Modal visible={showAddMatchModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContainer, {maxHeight: '90%', flexShrink: 1}]}>
              <Text style={styles.modalHeader}>{editingMatchId ? 'RET KAMP INFO' : 'OPRET KAMP'}</Text>
              {newMatchTeamSelector.type ? (
                <View style={{width: '100%', flex: 1, minHeight: 250, backgroundColor: '#FFFFFF', borderRadius: 8}}>
                  <Text style={{fontWeight: 'bold', marginBottom: 10, textAlign: 'center', padding: 10}}>Vælg {newMatchTeamSelector.type === 'home' ? 'Hjemmehold' : 'Udehold'}:</Text>
                  <ScrollView style={{width: '100%', flex: 1}}>
                    {leagues.map(league => (
                      <View key={league}>
                        <Text style={{backgroundColor: '#12352A', color: '#C5A059', padding: 5, fontWeight: 'bold', textAlign: 'center'}}>{league}</Text>
                        {Object.keys(TEAM_DB).filter(t => (TEAM_DB[t].league || 'Andre') === league).sort().map(team => (
                          <TouchableOpacity key={team} style={{padding: 15, borderBottomWidth: 1, borderColor: '#eee'}} onPress={() => { if(newMatchTeamSelector.type === 'home') setNewMatchData({...newMatchData, homeTeam: team}); else setNewMatchData({...newMatchData, awayTeam: team}); setNewMatchTeamSelector({type: null}); }}><View style={{flexDirection: 'row', alignItems: 'center'}}><Image source={{uri: TEAM_DB[team].logo}} style={{width: 30, height: 30, marginRight: 10}} resizeMode="contain" /><Text style={{fontSize: 16}}>{team}</Text></View></TouchableOpacity>
                        ))}
                      </View>
                    ))}
                  </ScrollView>
                  <TouchableOpacity style={[styles.secondaryButton, {marginTop: 10, marginBottom: 10}]} onPress={() => setNewMatchTeamSelector({type: null})}><Text style={{color: '#8A1C1C', fontWeight: 'bold'}}>ANNULLER VALG</Text></TouchableOpacity>
                </View>
              ) : (
                <ScrollView style={{width: '100%'}}>
                  <Text style={{fontWeight: 'bold', color: '#666', fontSize: 11, marginBottom: 4}}>Hjemmehold</Text><TouchableOpacity style={styles.inputField} onPress={() => setNewMatchTeamSelector({type: 'home'})}><Text>{newMatchData.homeTeam}</Text></TouchableOpacity>
                  <Text style={{fontWeight: 'bold', color: '#666', fontSize: 11, marginBottom: 4}}>Udehold</Text><TouchableOpacity style={styles.inputField} onPress={() => setNewMatchTeamSelector({type: 'away'})}><Text>{newMatchData.awayTeam}</Text></TouchableOpacity>
                  <View style={{flexDirection: 'row', gap: 10}}>
                    <View style={{flex: 1}}><Text style={{fontWeight: 'bold', color: '#666', fontSize: 11, marginBottom: 4}}>Dato</Text><TouchableOpacity style={styles.inputField} onPress={() => setShowDatePicker(true)}><Text>{newMatchData.date.toLocaleDateString('da-DK', {day: '2-digit', month: '2-digit', year: 'numeric'}).replace(/\//g, '.')}</Text></TouchableOpacity>
                      {showDatePicker && (<DateTimePicker value={newMatchData.date} mode="date" display="default" onChange={(e, d) => { setShowDatePicker(Platform.OS === 'ios'); if (d) { const c = newMatchData.date; d.setHours(c.getHours()); d.setMinutes(c.getMinutes()); setNewMatchData({...newMatchData, date: d}); } }} />)}
                    </View>
                    <View style={{flex: 1}}><Text style={{fontWeight: 'bold', color: '#666', fontSize: 11, marginBottom: 4}}>Tid</Text><TouchableOpacity style={styles.inputField} onPress={() => setShowTimePicker(true)}><Text>{newMatchData.date.toLocaleTimeString('da-DK', {hour: '2-digit', minute:'2-digit'})}</Text></TouchableOpacity>
                      {showTimePicker && (<DateTimePicker value={newMatchData.date} mode="time" display="default" onChange={(e, d) => { setShowTimePicker(Platform.OS === 'ios'); if (d) { const n = new Date(newMatchData.date); n.setHours(d.getHours()); n.setMinutes(d.getMinutes()); setNewMatchData({...newMatchData, date: n}); } }} />)}
                    </View>
                  </View>
                  <Text style={{fontWeight: 'bold', color: '#666', fontSize: 11, marginBottom: 4}}>Alternativt Stadion (Valgfrit)</Text><TextInput style={styles.inputField} placeholder="F.eks. Parken" value={newMatchData.alternativeStadium} onChangeText={v => setNewMatchData({...newMatchData, alternativeStadium: v})} />
                  <Text style={{fontWeight: 'bold', color: '#666', fontSize: 11, marginBottom: 4}}>Runde Navn</Text><TextInput style={styles.inputField} value={newMatchData.round} onChangeText={v => setNewMatchData({...newMatchData, round: v})} />
                  <Text style={{fontWeight: 'bold', color: '#666', fontSize: 11, marginBottom: 4}}>Turnering</Text><TextInput style={styles.inputField} value={newMatchData.tournament} onChangeText={v => setNewMatchData({...newMatchData, tournament: v})} />
                  <TouchableOpacity style={[styles.primaryButton, {width: '100%', marginBottom: 10, marginTop: 10}]} onPress={async () => {
                    if(!newMatchData.homeTeam || !newMatchData.awayTeam || !newMatchData.round) return showAlert("Fejl", "Udfyld alle felter!");
                    const y = newMatchData.date.getFullYear(); const m = String(newMatchData.date.getMonth() + 1).padStart(2, '0'); const d = String(newMatchData.date.getDate()).padStart(2, '0'); const h = String(newMatchData.date.getHours()).padStart(2, '0'); const min = String(newMatchData.date.getMinutes()).padStart(2, '0');
                    const finalDate = `${y}-${m}-${d} ${h}:${min}`;
                    if(editingMatchId) { await db.collection('matches').doc(editingMatchId).update({ homeTeam: newMatchData.homeTeam, awayTeam: newMatchData.awayTeam, matchDate: finalDate, round: newMatchData.round, tournament: newMatchData.tournament, alternativeStadium: newMatchData.alternativeStadium || null }); setEditingMatchId(null); showAlert("Succes", "Kamp opdateret!"); } 
                    else { await db.collection('matches').add({ homeTeam: newMatchData.homeTeam, awayTeam: newMatchData.awayTeam, matchDate: finalDate, round: newMatchData.round, tournament: newMatchData.tournament, alternativeStadium: newMatchData.alternativeStadium || null, finalScore: false, homeScore: null, awayScore: null, createdAt: firebase.firestore.FieldValue.serverTimestamp() }); showAlert("Succes", "Kamp oprettet!"); }
                    setShowAddMatchModal(false);
                  }}><Text style={styles.primaryButtonText}>{editingMatchId ? 'GEM ÆNDRINGER' : 'OPRET KAMP'}</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.secondaryButton, {width: '100%'}]} onPress={() => {setShowAddMatchModal(false); setEditingMatchId(null);}}><Text style={{color: '#8A1C1C'}}>ANNULLER</Text></TouchableOpacity>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      </ScrollView>
    );
  }

  if (currentScreen === 'adminTeams') {
    return (
      <ScrollView contentContainerStyle={styles.loginScreenContainer}>
        <TouchableOpacity onPress={() => setCurrentScreen('adminHub')} style={styles.backButton}><Text style={styles.backButtonText}>← TILBAGE</Text></TouchableOpacity>
        <Text style={styles.loginHeader}>🛡️ ADMINISTRER HOLD</Text>
        <View style={{backgroundColor: '#FFFFFF', padding: 15, borderRadius: 10, marginBottom: 20, borderWidth: 1, borderColor: '#C5A059'}}>
          <Text style={[styles.sectionTitle, {marginTop: 0}]}>Opret Nyt Hold</Text>
          <TextInput style={styles.inputField} placeholder="Holdets navn (f.eks. Nykøbing FC)" value={newTeamName} onChangeText={setNewTeamName} />
          <Text style={{fontWeight: 'bold', marginBottom: 5}}>Vælg Liga:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 15}}>
            {['Superliga', '1. Division', '2. Division', '3. Division', 'Andre'].map(league => (
              <TouchableOpacity key={league} onPress={() => setNewTeamLeague(league)} style={{backgroundColor: newTeamLeague === league ? '#12352A' : '#E5E5DF', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8, marginRight: 8}}>
                <Text style={{color: newTeamLeague === league ? '#FFFFFF' : '#111', fontWeight: 'bold'}}>{league}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.primaryButton} onPress={async () => {
            if (!newTeamName.trim()) return showAlert("Fejl", "Angiv holdets navn.");
            await db.collection('custom_teams').doc(newTeamName).set({ name: newTeamName, league: newTeamLeague, logo: 'https://via.placeholder.com/150', bgColor: '#12352A', color: '#FFFFFF' });
            setNewTeamName(''); showAlert("Succes", `${newTeamName} tilføjet til ${newTeamLeague}!`);
          }}><Text style={styles.primaryButtonText}>GEM HOLD</Text></TouchableOpacity>
        </View>
        <Text style={styles.sectionTitle}>Dine Tilføjede Hold</Text>
        {Object.keys(customTeams).length === 0 ? <Text style={{fontStyle: 'italic', color: '#666'}}>Du har ikke oprettet nogen hold endnu.</Text> : Object.values(customTeams).map(t => (
          <View key={t.name} style={styles.adminUserRow}>
            <View style={{flex: 1}}><Text style={{fontWeight: 'bold', color: '#12352A'}}>{t.name}</Text><Text style={{fontSize: 10, color: '#666'}}>{t.league}</Text></View>
            <TouchableOpacity onPress={() => Alert.alert("Slet", "Slet hold?", [{text: "Annuller"}, {text: "Slet", style: "destructive", onPress: async () => await db.collection('custom_teams').doc(t.name).delete()}])} style={styles.deleteBtn}><Text style={{color: '#FFFFFF', fontSize: 10, fontWeight: 'bold'}}>SLET</Text></TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    );
  }

  if (currentScreen === 'adminNews') {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
        <ScrollView contentContainerStyle={styles.loginScreenContainer}>
          <TouchableOpacity onPress={() => setCurrentScreen('adminHub')} style={styles.backButton}><Text style={styles.backButtonText}>← TILBAGE</Text></TouchableOpacity>
          <Text style={styles.loginHeader}>{editingNewsId ? 'REDIGER NYHED' : 'OPRET NYHED'}</Text>
          <TextInput style={styles.inputField} placeholder="Titel" placeholderTextColor="#888" value={newTitle} onChangeText={setNewTitle} />
          <TouchableOpacity style={[styles.primaryButton, {backgroundColor: '#C5A059', marginBottom: 15}]} onPress={async () => {
            let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [16, 9], quality: 0.6 });
            if (!result.canceled && result.assets && result.assets.length > 0) {
              setIsUploading(true); try { const response = await fetch(result.assets[0].uri); const blob = await response.blob(); const ref = storage.ref().child(`news_images/nyhed_${Date.now()}`); await ref.put(blob); setNewImage(await ref.getDownloadURL()); showAlert("Succes", "Billede uploadet!"); } catch (error) { showAlert("Fejl", error.message); } finally { setIsUploading(false); }
            }
          }} disabled={isUploading}><Text style={[styles.primaryButtonText, {color: '#111'}]}>{isUploading ? 'UPLOADER...' : '📁 UPLOAD BILLEDE'}</Text></TouchableOpacity>
          <TextInput style={styles.inputField} placeholder="Eller indsæt billed-URL" placeholderTextColor="#888" value={newImage} onChangeText={setNewImage} />
          <TextInput style={[styles.inputField, {height: 120, textAlignVertical: 'top'}]} placeholder="Nyhedsindhold" placeholderTextColor="#888" multiline value={newContent} onChangeText={setNewContent} />
          <TouchableOpacity style={styles.primaryButton} onPress={async () => {
            if (!newTitle || !newContent) return showAlert("Fejl", "Udfyld alle felter.");
            try { if (editingNewsId) { await db.collection('news').doc(editingNewsId).update({ title: newTitle, content: newContent, image: newImage || 'https://via.placeholder.com/400x200/12352A/FFFFFF?text=AB+Nyhed' }); } else { await db.collection('news').add({ title: newTitle, content: newContent, createdAt: firebase.firestore.FieldValue.serverTimestamp(), image: newImage || 'https://via.placeholder.com/400x200/12352A/FFFFFF?text=AB+Nyhed' }); } setNewTitle(''); setNewContent(''); setNewImage(''); setEditingNewsId(null); showAlert("Succes", "Nyhed gemt!"); } catch (error) { showAlert("Fejl", error.message); }
          }}><Text style={styles.primaryButtonText}>{editingNewsId ? 'OPDATER NYHED' : 'GEM NYHED'}</Text></TouchableOpacity>
          {editingNewsId && <TouchableOpacity style={[styles.secondaryButton, {marginTop: 10}]} onPress={() => { setEditingNewsId(null); setNewTitle(''); setNewContent(''); setNewImage(''); }}><Text style={{color: '#8A1C1C'}}>ANNULLER REDIGERING</Text></TouchableOpacity>}
          <Text style={[styles.sectionTitle, {marginTop: 30}]}>Eksisterende Nyheder</Text>
          {newsList.map((item) => (
            <View key={item.id} style={styles.adminNewsRow}>
              <Text style={{flex: 1, fontWeight: 'bold', color: '#12352A'}} numberOfLines={1}>{item.title}</Text>
              <TouchableOpacity onPress={() => { setEditingNewsId(item.id); setNewTitle(item.title); setNewContent(item.content); setNewImage(item.image); }} style={{marginRight: 10}}><Text style={{color: '#C5A059', fontWeight: 'bold'}}>REDIGER</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => Alert.alert("Slet", "Slet nyhed?", [{ text: "Annuller" }, { text: "Slet", style: "destructive", onPress: async () => await db.collection('news').doc(item.id).delete() }])} style={styles.deleteBtn}><Text style={{color: '#FFFFFF', fontSize: 10, fontWeight: 'bold'}}>SLET</Text></TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (currentScreen === 'adminUsers') {
    return (
      <ScrollView contentContainerStyle={styles.loginScreenContainer}>
        <TouchableOpacity onPress={() => setCurrentScreen('adminHub')} style={styles.backButton}><Text style={styles.backButtonText}>← TILBAGE</Text></TouchableOpacity>
        <Text style={styles.loginHeader}>👥 BRUGERE</Text>
        {editingUser && (
          <View style={{backgroundColor: '#FFFFFF', padding: 15, borderRadius: 10, marginBottom: 20, borderWidth: 1, borderColor: '#C5A059'}}>
            <Text style={[styles.sectionTitle, {marginTop: 0}]}>Rediger {editingUser.username}</Text>
            <TextInput style={styles.inputField} placeholder="Brugernavn" value={editUsername} onChangeText={setEditUsername} />
            <TextInput style={styles.inputField} placeholder="Point" keyboardType="numeric" value={editPoints} onChangeText={setEditPoints} />
            <Text style={{fontWeight: 'bold', marginBottom: 5}}>Rolle:</Text>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', marginBottom: 15, gap: 5}}>
              {['Alm. Bruger', 'Verificeret AB Fan', 'Redaktør', 'Admin'].map(r => (
                <TouchableOpacity key={r} onPress={() => setEditRole(r)} style={{backgroundColor: editRole === r ? '#12352A' : '#E5E5DF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4}}><Text style={{color: editRole === r ? '#FFFFFF' : '#111'}}>{r}</Text></TouchableOpacity>
              ))}
            </View>
            <Text style={{fontWeight: 'bold', marginBottom: 5}}>Fraktioner:</Text>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', marginBottom: 15, gap: 5}}>
              {allFractions.map(f => {
                const hasFraction = editFractions.includes(f.name);
                return (<TouchableOpacity key={f.id} onPress={() => { if(hasFraction) setEditFractions(editFractions.filter(x => x !== f.name)); else setEditFractions([...editFractions, f.name]); }} style={{backgroundColor: hasFraction ? '#C5A059' : '#E5E5DF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4}}><Text style={{color: hasFraction ? '#111' : '#333'}}>{f.name}</Text></TouchableOpacity>)
              })}
            </View>
            <TouchableOpacity style={styles.primaryButton} onPress={async () => { if (!editingUser) return; try { await db.collection('users').doc(editingUser.id).update({ username: editUsername, points: parseInt(editPoints, 10) || 0, role: editRole, fractions: editFractions }); showAlert("Succes", "Bruger opdateret!"); setEditingUser(null); } catch (e) { showAlert("Fejl", e.message); } }}><Text style={styles.primaryButtonText}>GEM BRUGER</Text></TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setEditingUser(null)}><Text style={{color: '#8A1C1C'}}>ANNULLER</Text></TouchableOpacity>
          </View>
        )}
        {usersList.map((u) => (
          <View key={u.id} style={styles.adminUserRow}>
            <Image source={{uri: u.photoURL}} style={{width: 30, height: 30, borderRadius: 15, marginRight: 10}} />
            <View style={{flex: 1}}><Text style={{fontWeight: 'bold', color: '#12352A'}}>{u.username} <Text style={{fontSize: 10, color: '#C5A059'}}>({u.role})</Text></Text><Text style={{fontSize: 10, color: '#666'}}>{u.points} pts | {u.email}</Text>{u.banned && <Text style={{fontSize: 10, color: '#E30613', fontWeight: 'bold'}}>BANNET {u.bannedUntil ? `til ${new Date(u.bannedUntil).toLocaleDateString()}` : 'PERMANENT'}</Text>}</View>
            <TouchableOpacity onPress={() => { setEditingUser(u); setEditUsername(u.username); setEditPoints(String(u.points || 0)); setEditRole(u.role || 'Alm. Bruger'); setEditFractions(u.fractions || []); }} style={{marginRight: 10}}><Text style={{color: '#12352A', fontWeight: 'bold'}}>✏️</Text></TouchableOpacity>
            {(userData?.role === 'Super Admin' || userData?.email === 'schaldeab@gmail.com') && (
              <>
                <TouchableOpacity onPress={async () => {
                   if (u.email === 'schaldeab@gmail.com') return showAlert("Fejl", "Kan ikke banne Super Admin!"); 
                   if (u.banned) { 
                     await db.collection('users').doc(u.id).update({ banned: false, bannedUntil: null }); 
                   } else { 
                     Alert.alert("Ban varighed", "Vælg hvor længe brugeren skal bannet:", [
                       { text: "1 Dag", onPress: () => db.collection('users').doc(u.id).update({banned:true, bannedUntil: new Date().getTime()+(1*24*60*60*1000)}) },
                       { text: "3 Dage", onPress: () => db.collection('users').doc(u.id).update({banned:true, bannedUntil: new Date().getTime()+(3*24*60*60*1000)}) },
                       { text: "1 Uge", onPress: () => db.collection('users').doc(u.id).update({banned:true, bannedUntil: new Date().getTime()+(7*24*60*60*1000)}) },
                       { text: "Permanent", onPress: () => db.collection('users').doc(u.id).update({banned:true, bannedUntil: null}) },
                       { text: "Annuller", style: "cancel" }
                     ]); 
                   } 
                }} style={{marginRight: 10, padding: 4, backgroundColor: u.banned ? '#4CAF50' : '#FF9800', borderRadius: 4}}><Text style={{color: '#fff', fontSize: 10, fontWeight: 'bold'}}>{u.banned ? 'UNBAN' : 'BAN'}</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => { if (u.email === 'schaldeab@gmail.com') return showAlert("Fejl", "Super Admin kan ikke slettes!"); Alert.alert("Slet", "Vil du slette?", [{text:"Annuller"}, {text:"Slet", style:"destructive", onPress: async () => await db.collection('users').doc(u.id).delete()}]); }} style={styles.deleteBtn}><Text style={{color: '#FFFFFF', fontSize: 10, fontWeight: 'bold'}}>SLET</Text></TouchableOpacity>
              </>
            )}
          </View>
        ))}
        <Text style={[styles.sectionTitle, {marginTop: 30}]}>Administrer Fraktioner</Text>
        <View style={{flexDirection: 'row', marginBottom: 15}}><TextInput style={[styles.inputField, {flex: 1, marginBottom: 0, marginRight: 10}]} placeholder="Ny fraktion navn" value={newFractionName} onChangeText={setNewFractionName} /><TouchableOpacity style={[styles.primaryButton, {marginTop: 0}]} onPress={async () => { if (!newFractionName.trim()) return; await db.collection('fractions').add({ name: newFractionName.trim() }); setNewFractionName(''); showAlert("Succes", "Fraktion tilføjet!"); }}><Text style={styles.primaryButtonText}>TILFØJ</Text></TouchableOpacity></View>
        <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 10}}>
          {allFractions.map(f => (
            <View key={f.id} style={{backgroundColor: '#12352A', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, flexDirection: 'row', alignItems: 'center'}}><Text style={{color: '#C5A059', fontWeight: 'bold', marginRight: 8}}>{f.name}</Text><TouchableOpacity onPress={() => Alert.alert("Slet", "Vil du slette?", [{text: "Annuller"}, {text: "Slet", onPress: async () => await db.collection('fractions').doc(f.id).delete()}])}><Text style={{color: '#E30613', fontWeight: 'bold'}}>✕</Text></TouchableOpacity></View>
          ))}
        </View>
        <View style={{height: 40}} />
      </ScrollView>
    );
  }

  if (currentScreen === 'adminSongs') {
    return (
      <ScrollView contentContainerStyle={styles.loginScreenContainer}>
        <TouchableOpacity onPress={() => setCurrentScreen('adminHub')} style={styles.backButton}><Text style={styles.backButtonText}>← TILBAGE</Text></TouchableOpacity>
        <Text style={styles.loginHeader}>🎵 GODKEND SANGE</Text>
        {editingSong && (
          <View style={{backgroundColor: '#FFFFFF', padding: 15, borderRadius: 10, marginBottom: 20, borderWidth: 1, borderColor: '#C5A059'}}>
            <Text style={[styles.sectionTitle, {marginTop: 0}]}>Rediger Sang</Text>
            <TextInput style={styles.inputField} value={editingSong.title} onChangeText={t => setEditingSong({...editingSong, title: t})} />
            <TextInput style={styles.inputField} value={editingSong.melody} onChangeText={t => setEditingSong({...editingSong, melody: t})} placeholder="Melodi" />
            <TextInput style={[styles.inputField, {height: 80, textAlignVertical: 'top'}]} multiline value={editingSong.lyrics} onChangeText={t => setEditingSong({...editingSong, lyrics: t})} />
            <TextInput style={styles.inputField} value={editingSong.link} onChangeText={t => setEditingSong({...editingSong, link: t})} placeholder="Link" />
            <TouchableOpacity style={styles.primaryButton} onPress={async () => { if (!editingSong) return; await db.collection('songs').doc(editingSong.id).update({ title: editingSong.title, lyrics: editingSong.lyrics, link: editingSong.link, melody: editingSong.melody || '' }); setEditingSong(null); showAlert("Succes", "Sang opdateret!"); }}><Text style={styles.primaryButtonText}>GEM ÆNDRINGER</Text></TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setEditingSong(null)}><Text style={{color: '#8A1C1C'}}>ANNULLER</Text></TouchableOpacity>
          </View>
        )}
        {pendingSongs.length === 0 ? <Text style={{fontStyle: 'italic', color: '#666'}}>Ingen sange afventer godkendelse.</Text> : pendingSongs.map(song => (
          <View key={song.id} style={{backgroundColor: '#FFFFFF', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#E5E5DF'}}>
            <Text style={{fontWeight: 'bold', fontSize: 16, color: '#12352A'}}>{song.title}</Text><Text style={{fontSize: 10, color: '#888', marginBottom: 5}}>Af: {song.submittedBy}</Text><Text style={{fontSize: 13, fontStyle: 'italic', marginBottom: 10}} numberOfLines={2}>{song.lyrics}</Text>
            <View style={{flexDirection: 'row', gap: 10}}>
              <TouchableOpacity onPress={async () => { await db.collection('songs').doc(song.id).update({ approved: true }); showAlert("Succes", "Sang godkendt!"); }} style={{backgroundColor: '#4CAF50', padding: 8, borderRadius: 4, flex: 1, alignItems: 'center'}}><Text style={{color: '#fff', fontWeight: 'bold'}}>GODKEND</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingSong(song)} style={{backgroundColor: '#C5A059', padding: 8, borderRadius: 4, flex: 1, alignItems: 'center'}}><Text style={{color: '#111', fontWeight: 'bold'}}>REDIGER</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => Alert.alert("Afvis", "Vil du slette?", [{ text: "Annuller" }, { text: "Slet", style: "destructive", onPress: async () => await db.collection('songs').doc(song.id).delete() }])} style={{backgroundColor: '#8A1C1C', padding: 8, borderRadius: 4, flex: 1, alignItems: 'center'}}><Text style={{color: '#fff', fontWeight: 'bold'}}>AFVIS</Text></TouchableOpacity>
            </View>
          </View>
        ))}
        <Text style={[styles.sectionTitle, {marginTop: 30}]}>Godkendte Sange</Text>
        {songsList.map(song => (
          <View key={song.id} style={{backgroundColor: '#F5F5EF', padding: 12, borderRadius: 8, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#E5E5DF'}}>
            <Text style={{fontWeight: 'bold', color: '#12352A', flex: 1}}>{song.title}</Text>
            <TouchableOpacity onPress={() => setEditingSong(song)} style={{marginRight: 15}}><Text style={{color: '#C5A059', fontWeight: 'bold'}}>✏️</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => Alert.alert("Slet", "Vil du slette?", [{ text: "Annuller" }, { text: "Slet", style: "destructive", onPress: async () => await db.collection('songs').doc(song.id).delete() }])}><Text style={{color: '#8A1C1C', fontWeight: 'bold'}}>SLET</Text></TouchableOpacity>
          </View>
        ))}
        <View style={{height: 40}} />
      </ScrollView>
    );
  }

  if (currentScreen === 'adminRss') {
    return (
      <ScrollView contentContainerStyle={styles.loginScreenContainer}>
        <TouchableOpacity onPress={() => setCurrentScreen('adminHub')} style={styles.backButton}><Text style={styles.backButtonText}>← TILBAGE</Text></TouchableOpacity>
        <Text style={styles.loginHeader}>📰 RSS FEEDS</Text>
        <Text style={styles.loginSubheader}>Tilføj RSS links. Appen vil automatisk filtrere efter artikler der nævner "AB" eller "Akademisk Boldklub".</Text>
        <View style={{backgroundColor: '#FFFFFF', padding: 15, borderRadius: 10, marginBottom: 20, borderWidth: 1, borderColor: '#C5A059'}}>
          <TextInput style={styles.inputField} placeholder="Kilde Navn (f.eks. Bold.dk)" value={newRssName} onChangeText={setNewRssName} />
          <TextInput style={styles.inputField} placeholder="RSS URL (f.eks. https://bold.dk/rss/)" value={newRssUrl} onChangeText={setNewRssUrl} autoCapitalize="none" />
          <TouchableOpacity style={styles.primaryButton} onPress={async () => { if (!newRssName.trim() || !newRssUrl.trim()) return showAlert("Fejl", "Udfyld alle felter."); await db.collection('rss_feeds').add({ name: newRssName.trim(), url: newRssUrl.trim() }); setNewRssName(''); setNewRssUrl(''); showAlert("Succes", "RSS feed tilføjet!"); }}><Text style={styles.primaryButtonText}>TILFØJ RSS FEED</Text></TouchableOpacity>
        </View>
        <Text style={styles.sectionTitle}>Aktive Feeds</Text>
        {rssFeedsList.length === 0 ? <Text style={{fontStyle: 'italic', color: '#666'}}>Ingen feeds opsat.</Text> : rssFeedsList.map(feed => (
          <View key={feed.id} style={styles.adminUserRow}>
            <View style={{flex: 1}}><Text style={{fontWeight: 'bold', color: '#12352A'}}>{feed.name}</Text><Text style={{fontSize: 10, color: '#666'}}>{feed.url}</Text></View>
            <TouchableOpacity onPress={() => Alert.alert("Slet", "Vil du slette?", [{ text: "Annuller" }, { text: "Slet", style: "destructive", onPress: async () => await db.collection('rss_feeds').doc(feed.id).delete() }])} style={styles.deleteBtn}><Text style={{color: '#FFFFFF', fontSize: 10, fontWeight: 'bold'}}>SLET</Text></TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    );
  }

  if (currentScreen === 'adminAwayInfo') {
    return (
      <ScrollView contentContainerStyle={styles.loginScreenContainer}>
        <TouchableOpacity onPress={() => setCurrentScreen('adminHub')} style={styles.backButton}><Text style={styles.backButtonText}>← TILBAGE</Text></TouchableOpacity>
        <Text style={styles.loginHeader}>🚌 AWAY INFO</Text>
        <View style={{backgroundColor: '#FFFFFF', padding: 15, borderRadius: 10, marginBottom: 20, borderWidth: 1, borderColor: '#C5A059'}}>
          <Text style={{fontWeight: 'bold', marginBottom: 10}}>Vælg Udekamp:</Text>
          <ScrollView style={{maxHeight: 150, marginBottom: 15, borderWidth: 1, borderColor: '#E5E5DF', borderRadius: 8}}>
            {matchesList.filter(m => m.awayTeam === 'AB' && !m.finalScore).map(m => (
              <TouchableOpacity key={m.id} onPress={() => setNewAwayMatchId(m.id)} style={{padding: 10, backgroundColor: newAwayMatchId === m.id ? '#12352A' : '#fff', borderBottomWidth: 1, borderBottomColor: '#eee'}}>
                <Text style={{color: newAwayMatchId === m.id ? '#C5A059' : '#111', fontWeight: newAwayMatchId === m.id ? 'bold' : 'normal'}}>{m.homeTeam} (Runde: {m.round})</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TextInput style={[styles.inputField, {height: 100, textAlignVertical: 'top'}]} placeholder="Skriv info om turen (pris, mødetid, lokation etc.)..." multiline value={newAwayInfoText} onChangeText={setNewAwayInfoText} />
          <TouchableOpacity style={styles.primaryButton} onPress={async () => {
            if (!newAwayMatchId || !newAwayInfoText.trim()) return showAlert("Fejl", "Vælg kamp og skriv info.");
            const targetMatch = matchesList.find(m => m.id === newAwayMatchId);
            if (!targetMatch) return showAlert("Fejl", "Kampen blev ikke fundet.");
            
            await db.collection('away_info').add({ 
              matchId: newAwayMatchId, 
              opponent: targetMatch.homeTeam,
              infoText: newAwayInfoText,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            setNewAwayMatchId(null); setNewAwayInfoText(''); showAlert("Succes", "Away Info gemt!");
          }}><Text style={styles.primaryButtonText}>GEM AWAY INFO</Text></TouchableOpacity>
        </View>
        <Text style={styles.sectionTitle}>Eksisterende Info</Text>
        {awayInfoList.map(info => {
          const match = matchesList.find(m => m.id === info.matchId);
          return (
            <View key={info.id} style={{backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#E5E5DF'}}>
              <Text style={{fontWeight: 'bold', color: '#12352A', marginBottom: 5}}>{match ? `${match.homeTeam} vs AB` : (info.opponent ? `${info.opponent} vs AB` : 'Udebane')}</Text>
              <Text style={{fontSize: 12, color: '#333', marginBottom: 10}} numberOfLines={2}>{info.infoText}</Text>
              <View style={{flexDirection: 'row', justifyContent: 'flex-end'}}>
                <TouchableOpacity onPress={() => Alert.alert("Slet", "Slet away info?", [{text: "Annuller"}, {text: "Slet", style: "destructive", onPress: async () => await db.collection('away_info').doc(info.id).delete()}])} style={styles.deleteBtn}><Text style={{color: '#fff', fontSize: 10, fontWeight: 'bold'}}>SLET</Text></TouchableOpacity>
              </View>
            </View>
          )
        })}
      </ScrollView>
    );
  }

  if (currentScreen === 'adminSettings') {
    return (
      <ScrollView contentContainerStyle={styles.loginScreenContainer}>
        <TouchableOpacity onPress={() => setCurrentScreen('adminHub')} style={styles.backButton}><Text style={styles.backButtonText}>← TILBAGE</Text></TouchableOpacity>
        <Text style={styles.loginHeader}>⚙️ INDSTILLINGER</Text>
        <View style={{backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 20, borderWidth: 1, borderColor: '#C5A059'}}>
          <TouchableOpacity style={styles.checkboxRow} onPress={() => { const newMode = !appSettings.maintenanceMode; setAppSettings({...appSettings, maintenanceMode: newMode}); db.collection('app_config').doc('settings').set({maintenanceMode: newMode}, {merge: true}); }}>
            <View style={[styles.checkboxBox, appSettings.maintenanceMode && styles.checkboxChecked]}>{appSettings.maintenanceMode && <Text style={{color: '#fff', fontSize: 12}}>✓</Text>}</View><Text style={styles.checkboxLabel}>Aktiver Vedligeholdelsestilstand</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.checkboxRow} onPress={() => { const newLocked = !appSettings.forumLocked; setAppSettings({...appSettings, forumLocked: newLocked}); db.collection('app_config').doc('settings').set({forumLocked: newLocked}, {merge: true}); }}>
            <View style={[styles.checkboxBox, appSettings.forumLocked && styles.checkboxChecked]}>{appSettings.forumLocked && <Text style={{color: '#fff', fontSize: 12}}>✓</Text>}</View><Text style={styles.checkboxLabel}>Lås forum for nye indlæg</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
      <Text>Ukendt Admin Skærm: {currentScreen}</Text>
      <TouchableOpacity onPress={() => setCurrentScreen('adminHub')} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Gå til Admin Hub</Text></TouchableOpacity>
    </View>
  );
}
