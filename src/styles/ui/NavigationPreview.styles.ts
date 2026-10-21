import { StyleSheet } from 'react-native';
export default StyleSheet.create({
  actionRow: { flexDirection:'row', gap:8, marginTop:8 },
  secondaryButton: {flex:1, backgroundColor:'#EFF6FF', borderRadius:9,
    paddingVertical:7, alignItems:'center', borderWidth:1, borderColor:'#BFDBFE'},
  secondaryText: {fontSize:9, fontWeight:'800', color:'#1D4ED8'},
  legend: {fontSize:9, marginTop:7, color:'#1D4ED8', fontWeight:'700'},
  warning: {fontSize:9, marginTop:6, lineHeight:13, color:'#9A3412', fontWeight:'700'},
});
