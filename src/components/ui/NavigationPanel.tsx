import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { PreviewPlan } from '../../navigation/routePreview';
import type { EmergencyType } from '../../emergency/emergencyTypes';
import classic from '../../styles/ui/ClassicUI.styles';

type Props = {
  plan: PreviewPlan | null;
  emergencyMode: EmergencyType;
  liveStatus: string;
  outsideCampus: boolean;
  routeWarning?: boolean;
  onChangeEmergency: () => void;
  onRetryGps: () => void;
};

/** Field navigation: no manual tap simulation, debug graph, or test-alert controls. */
export default function NavigationPanel({plan,emergencyMode,liveStatus,outsideCampus,routeWarning=false,
  onChangeEmergency,onRetryGps}:Props) {
  return (
    <View style={classic.bottomPanel}>
      <View style={s.headerRow}>
        <View style={[s.statusIcon,{backgroundColor:outsideCampus?'#FEF3C7':'#E9F7EF'}]}>
          <MaterialCommunityIcons name={outsideCampus?'map-marker-off':'crosshairs-gps'} size={22}
            color={outsideCampus?'#B45309':'#15803D'}/>
        </View>
        <View style={s.headerCopy}>
          <Text style={s.eyebrow}>{emergencyMode.toUpperCase()} · LIVE CAMPUS NAVIGATION</Text>
          <Text style={s.title}>{outsideCampus?'Outside the mapped campus':plan?'Route automatically updating':'Acquiring outdoor GPS route'}</Text>
        </View>
      </View>
      {outsideCampus && (
        <View style={s.outsideAlert} accessibilityLiveRegion="polite">
          <MaterialCommunityIcons name="alert-circle-outline" size={19} color="#9A3412" />
          <Text style={s.outsideText}>
            You appear to be outside UST–Legazpi Rawis Campus. TomaSafe navigation only works within the mapped campus area. No route will be shown here.
          </Text>
        </View>
      )}
      {!outsideCampus && !plan && (
        <Text style={s.gpsText} accessibilityLiveRegion="polite">{liveStatus}</Text>
      )}
      {!!plan && !outsideCampus && (
        <>
          <Text style={s.destination}>Destination: {plan.area.name} · Recalculates as you walk</Text>
          {routeWarning && <Text style={s.caution} accessibilityLiveRegion="polite">{liveStatus}</Text>}
        </>
      )}
      <View style={s.actions}>
        <Pressable accessibilityRole="button" style={s.action} onPress={onRetryGps}>
          <MaterialCommunityIcons name="refresh" size={17} color="#1D4ED8"/>
          <Text style={s.actionText}>RETRY GPS</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={s.action} onPress={onChangeEmergency}>
          <MaterialCommunityIcons name="swap-horizontal" size={17} color="#1D4ED8"/>
          <Text style={s.actionText}>CHANGE ALERT</Text>
        </Pressable>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  headerRow:{flexDirection:'row',gap:10,alignItems:'center'},
  statusIcon:{width:42,height:42,borderRadius:13,alignItems:'center',justifyContent:'center'},
  headerCopy:{flex:1,gap:4},eyebrow:{fontSize:10,color:'#64748B',fontWeight:'800',letterSpacing:0.25},
  title:{fontWeight:'900',color:'#172A43',fontSize:15},
  gpsText:{fontSize:12,color:'#475569',lineHeight:17,marginTop:9},
  outsideAlert:{flexDirection:'row',gap:9,backgroundColor:'#FFF7ED',padding:11,
    borderWidth:1,borderColor:'#FDBA74',borderRadius:12,marginTop:10},
  outsideText:{flex:1,fontSize:12,color:'#9A3412',lineHeight:17,fontWeight:'700'},
  caution:{fontSize:11,color:'#92400E',marginTop:5,fontWeight:'600'},
  destination:{fontSize:11,fontWeight:'800',color:'#15803D',marginTop:5},
  actions:{flexDirection:'row',gap:8,marginTop:11},
  action:{flex:1,paddingVertical:10,borderRadius:10,backgroundColor:'#EFF6FF',
    borderWidth:1,borderColor:'#BFDBFE',flexDirection:'row',gap:6,alignItems:'center',justifyContent:'center'},
  actionText:{fontSize:10,fontWeight:'800',color:'#1D4ED8'},
});
