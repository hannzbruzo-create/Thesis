import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Speech from 'expo-speech';
import * as Location from 'expo-location';
import type { Point } from '../../navigation/walkableGraph';
import { checkSimulatedOutside, evaluateOutdoorGps, type OutdoorCheck } from '../../navigation/outdoorSafety';
import type { EmergencyType } from '../../emergency/emergencyTypes';
import styles from '../../styles/ui/EmergencyFlow.styles';

type Props={type:EmergencyType; simulatedPoint:Point|null; onReady:(p:Point)=>void};
const EXIT_REMINDER='Outdoor navigation starts only after you have safely exited the building. Follow the posted exit signs and directions from campus emergency personnel. Do not use elevators. If the exit is unsafe, find another safe way out or ask responders for assistance.';
export default function OutdoorGate({type,simulatedPoint,onReady}:Props){
  const [check,setCheck]=useState<OutdoorCheck|null>(null);
  const [checking,setChecking]=useState(false);
  const [confirmed,setConfirmed]=useState(false);
  const [error,setError]=useState('');
  const alive=useRef(true);
  const requestRef=useRef(0);
  const lastReminder=useRef(0);
  const remind=useCallback(()=>{
    const now=Date.now();
    if(now-lastReminder.current<7000)return;
    lastReminder.current=now;
    void Speech.stop().then(()=>{if(alive.current)Speech.speak(EXIT_REMINDER,{language:'en-US',rate:0.88});});
  },[]);
  const checkGps=useCallback(async()=>{
    const id=++requestRef.current;
    setChecking(true);setError('');setCheck(null);
    try{
      const permission=await Location.requestForegroundPermissionsAsync();
      if(!permission.granted)throw new Error('Location permission is required for automatic GPS routing.');
      const fix=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.High});
      if(!alive.current||id!==requestRef.current)return;
      const result=evaluateOutdoorGps(fix.coords.latitude,fix.coords.longitude,fix.coords.accuracy);
      setCheck(result);
      if(result.status==='inside')remind();
    }catch(err){
      if(alive.current&&id===requestRef.current)setError(err instanceof Error?err.message:'Could not get a reliable location.');
    }finally{if(alive.current&&id===requestRef.current)setChecking(false);}
  },[remind]);
  useEffect(()=>{
    alive.current=true;
    remind();
    void checkGps();
    return ()=>{alive.current=false;requestRef.current++;void Speech.stop();};
  },[checkGps,remind]);
  const testCheck=simulatedPoint?checkSimulatedOutside(simulatedPoint):null;
  const canProceed=confirmed&&check?.status==='outside'&&!!check.point;
  return <View style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={[styles.hero,{backgroundColor:'#0F766E'}]}>
        <MaterialCommunityIcons name="exit-run" color="white" size={68}/>
        <Text style={styles.heroTitle}>ARE YOU SAFELY OUTSIDE?</Text>
        <Text style={styles.heroSubtitle}>{type==='earthquake'?'Move only after shaking stops and the exit is safe.':'Avoid smoke, blocked exits and unsafe routes.'}</Text>
      </View>
      <Text style={styles.sectionTitle}>Before showing an outdoor route</Text>
      <View style={styles.stepCard}><MaterialCommunityIcons name="door-open" size={29} color="#047857"/><Text style={styles.stepText}>Leave the building through a safe exit. Follow official emergency instructions.</Text></View>
      <View style={styles.stepCard}><MaterialCommunityIcons name="map-marker-check" size={29} color="#2563EB"/><Text style={styles.stepText}>The app needs a fresh, sufficiently accurate location that is clear of mapped buildings.</Text></View>
      <Pressable accessibilityRole="button" style={[styles.checkboxLine,{borderColor:confirmed?'#047857':'#CBD5E1'}]} onPress={()=>setConfirmed(v=>!v)}>
        <MaterialCommunityIcons name={confirmed?'checkbox-marked':'checkbox-blank-outline'} color="#047857" size={24}/>
        <Text style={styles.checkboxText}>I confirm I am physically outside, away from the building and following campus instructions.</Text>
      </Pressable>
      <View style={styles.statusCard}>
        <Text style={styles.statusHeading}>GPS outdoor check</Text>
        {checking?<ActivityIndicator color="#2563EB"/>:
          <Text style={styles.statusDetail}>{error || check?.detail || 'Checking device location…'}</Text>}
        <Text style={styles.caution}>GPS and the campus SVG are not precise enough to certify safety. A clear result is only a screening check.</Text>
      </View>
      <Pressable accessibilityRole="button" disabled={!canProceed||checking} style={[styles.primaryButton,(!canProceed||checking)&&styles.disabledButton]}
        onPress={()=>{if(canProceed&&check?.point){void Speech.stop();onReady(check.point);}}}>
        <Text style={styles.primaryButtonText}>I'M OUTSIDE — SHOW EVACUATION ROUTE</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={()=>void checkGps()} style={styles.secondaryButton} disabled={checking}>
        <Text style={styles.secondaryButtonText}>CHECK MY LOCATION AGAIN</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={remind} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>STILL INSIDE — REPEAT EXIT REMINDER</Text>
      </Pressable>
      {__DEV__&&simulatedPoint&&<View style={styles.developerBox}>
        <Text style={styles.developerTitle}>DEVELOPER TEST ONLY — NO GPS</Text>
        <Text style={styles.statusDetail}>{testCheck?.detail}</Text>
        <Pressable accessibilityRole="button" style={styles.secondaryButton}
          disabled={!confirmed||testCheck?.status!=='outside'}
          onPress={()=>{if(confirmed&&testCheck?.status==='outside'&&testCheck.point){void Speech.stop();onReady(testCheck.point);}}}>
          <Text style={styles.secondaryButtonText}>USE SELECTED SIMULATED OUTDOOR POINT</Text>
        </Pressable>
      </View>}
    </ScrollView>
  </View>;
}
