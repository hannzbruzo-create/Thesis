import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { EmergencyType } from '../../emergency/emergencyTypes';

type Props = { onSelect: (type: EmergencyType) => void };

/** Opens on every fresh launch. No push/FCM runtime required in Expo Go. */
export default function EmergencyChooser({ onSelect }: Props) {
  return (
    <View style={s.overlay} accessibilityViewIsModal>
      <View style={s.card}>
        <View style={s.logoRow}>
          <View style={s.logo}>
            <MaterialCommunityIcons name="shield-check-outline" size={23} color="#FFFFFF" />
          </View>
          <Text style={s.brand}>Toma<Text style={s.brandBlue}>Safe</Text></Text>
        </View>
        <Text style={s.eyebrow}>UST–LEGAZPI · RAWIS CAMPUS</Text>
        <Text style={s.title}>Select an emergency</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Fire emergency instructions"
          style={[s.choice, s.fire]} onPress={() => onSelect('fire')}>
          <View style={[s.choiceIcon,{backgroundColor:'#FEE2E2'}]}>
            <MaterialCommunityIcons name="fire-alert" size={28} color="#B42318" />
          </View>
          <View style={s.choiceText}>
            <Text style={s.choiceTitle}>Fire</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={25} color="#B42318" />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Earthquake emergency instructions"
          style={[s.choice,s.quake]} onPress={() => onSelect('earthquake')}>
          <View style={[s.choiceIcon,{backgroundColor:'#FFF1CE'}]}>
            <MaterialCommunityIcons name="home-alert" size={28} color="#AD6800" />
          </View>
          <View style={s.choiceText}>
            <Text style={s.choiceTitle}>Earthquake</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={25} color="#AD6800" />
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay:{position:'absolute',top:0,bottom:0,left:0,right:0,zIndex:120,elevation:120,
    backgroundColor:'rgba(15,23,42,0.6)',justifyContent:'center',paddingHorizontal:18},
  card:{backgroundColor:'#FFFFFF',borderRadius:24,padding:22,gap:14,
    shadowColor:'#0F172A',shadowOffset:{width:0,height:8},shadowOpacity:0.15,shadowRadius:18,elevation:12},
  logoRow:{flexDirection:'row',alignItems:'center',gap:9},
  logo:{width:37,height:37,borderRadius:12,backgroundColor:'#244E9A',alignItems:'center',justifyContent:'center'},
  brand:{fontWeight:'900',fontSize:20,color:'#182A42'},brandBlue:{color:'#2563EB'},
  eyebrow:{fontSize:10,fontWeight:'800',letterSpacing:1.3,color:'#64748B'},
  title:{fontSize:23,fontWeight:'900',color:'#14243A',marginTop:2},
  choice:{minHeight:77,borderWidth:1,borderRadius:16,flexDirection:'row',alignItems:'center',padding:12,gap:12},
  fire:{borderColor:'#FBC9C4',backgroundColor:'#FFF8F7'},
  quake:{borderColor:'#F4DAA4',backgroundColor:'#FFFCF5'},
  choiceIcon:{width:52,height:52,borderRadius:14,alignItems:'center',justifyContent:'center'},
  choiceText:{flex:1},choiceTitle:{fontSize:17,fontWeight:'900',color:'#172A43'},
});
