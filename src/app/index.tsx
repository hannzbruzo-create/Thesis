import { MaterialCommunityIcons } from '@expo/vector-icons';



import * as Location from 'expo-location';



import { useEffect, useState } from 'react';





import {
  Alert,



  Dimensions,



  StatusBar,



  StyleSheet,



  Text,



  TouchableOpacity,



  View,
} from 'react-native';



import {
  Gesture,



  GestureDetector,



  GestureHandlerRootView,
} from 'react-native-gesture-handler';



import Animated, {
  cancelAnimation,

  Easing,

  runOnJS,

  useAnimatedProps,



  useAnimatedStyle,



  useSharedValue,



  withRepeat,

  withSpring,



  withTiming,
} from 'react-native-reanimated';



import { SafeAreaView } from 'react-native-safe-area-context';



import Svg, { Polyline } from 'react-native-svg';



import UstMapSvg from '../../assets/images/ust.svg';



import BuildingLabels from '../components/BuildingLabels';



import CampusContext from '../components/CampusContext';



import CampusFadeOverlay from '../components/CampusFadeOverlay';

import BuildingDepthLayer from '../components/BuildingDepthLayer';






import EvacuationAreas from '../components/evacuationAreas';



import {
  calculateOutdoorRoute,

  calculateShortestPath,

  gpsToMapPosition,

  NODES,

  RouteResult
} from '../components/navigationUtils';



// Animated SVG route highlight (one component, outside HomeScreen).

const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);



// =========================================================



// CONSTANTS



// =========================================================



const {



  height: SCREEN_HEIGHT,



  width: SCREEN_WIDTH,



} = Dimensions.get('window');



const MAP_SIZE = 1200;



// The outside context is 1200x1200 while the real UST map is 800x800.



// That makes the visual context 1.5x larger than the navigation map.



const CONTEXT_SCALE = 1200 / 800;



const CONTEXT_SIZE = MAP_SIZE * CONTEXT_SCALE;



const MIN_ZOOM = 0.22;



const MAX_ZOOM = 4;



const DEFAULT_VIEWPORT_WIDTH = SCREEN_WIDTH;



const DEFAULT_VIEWPORT_HEIGHT = SCREEN_HEIGHT;



// =========================================================



// HOME SCREEN



// =========================================================



export default function HomeScreen() {



  // Use the actual visible map area so centering behaves consistently



  // across phones with different screen sizes/aspect ratios.



  const [viewportSize, setViewportSize] = useState({



    width: DEFAULT_VIEWPORT_WIDTH,



    height: DEFAULT_VIEWPORT_HEIGHT,



  });



  // =======================================================



  // GPS POSITION



  // =======================================================



  const [



    userPos,



    setUserPos,



  ] = useState({



    x: 50,



    y: 50,



  });



  const [



    locationGranted,



    setLocationGranted,



  ] = useState(false);



  const [



    isInsideCampus,



    setIsInsideCampus,



  ] = useState(false);



  const [



    locationAccuracy,



    setLocationAccuracy,



  ] = useState<



    number | null



  >(null);



  const [



    isWaitingForLocation,



    setIsWaitingForLocation,



  ] = useState(true);



  // =======================================================



  // NAVIGATION



  // =======================================================



  const [



    activeRoute,



    setActiveRoute,



  ] = useState<



    RouteResult | null



  >(null);



  const [



  selectedEvacuationAreaId,



  setSelectedEvacuationAreaId,



] = useState<string | null>(null);



  // DEV-ONLY OUTDOOR ROUTE TESTING.

  // Works without campus GPS and never appears in release builds.

  const [testExit, setTestExit] = useState<'N2' | 'N3' | 'N4'>('N2');

  const [isTestRoute, setIsTestRoute] = useState(false);

  const [devPanelExpanded, setDevPanelExpanded] = useState(false);

  const [bottomPanelHeight, setBottomPanelHeight] = useState(112);

  const [overviewMode, setOverviewMode] = useState(false);

  const [gpsHeading, setGpsHeading] = useState<number | null>(null);

  const mapTilt = useSharedValue(0);



  // =======================================================



  // MAP PAN



  // =======================================================



  const translateX =



    useSharedValue(0);



  const translateY =



    useSharedValue(0);



  const savedTranslateX =



    useSharedValue(0);



  const savedTranslateY =



    useSharedValue(0);



  // =======================================================



  // MAP ZOOM



  // =======================================================



  const scale =



    useSharedValue(1);



  const savedScale =



    useSharedValue(1);



  const pinchStartX =



    useSharedValue(0);



  const pinchStartY =



    useSharedValue(0);



  const pinchStartTranslateX =



    useSharedValue(0);



  const pinchStartTranslateY =



    useSharedValue(0);



  const [



    zoomDisplay,



    setZoomDisplay,



  ] = useState(1);



  // Subtle moving highlight on the calculated blue path.

  const routeDashOffset = useSharedValue(0);

  const animatedRouteProps = useAnimatedProps(() => ({

    strokeDashoffset: routeDashOffset.value,

  }));



  useEffect(() => {

    if (activeRoute?.success) {

      routeDashOffset.value = 0;

      routeDashOffset.value = withRepeat(

        withTiming(-4.4, {

          duration: 1800,

          easing: Easing.linear,

        }),

        -1,

        false

      );

    } else {

      cancelAnimation(routeDashOffset);

      routeDashOffset.value = 0;

    }

    return () => cancelAnimation(routeDashOffset);

  }, [activeRoute]);



  // =======================================================



  // SMOOTH MARKER



  // =======================================================



  const markerX =



    useSharedValue(50);



  const markerY =



    useSharedValue(50);



  // =======================================================



  // GPS TRACKING



  // =======================================================



  useEffect(() => {



    let subscription:



      Location.LocationSubscription



      | null = null;



    const startLocation =



      async () => {



        try {



          const permission =



            await Location



              .requestForegroundPermissionsAsync();



          if (



            permission.status !==



            'granted'



          ) {



            setLocationGranted(



              false



            );



            setIsWaitingForLocation(



              false



            );



            return;



          }



          setLocationGranted(



            true



          );



          subscription =



            await Location



              .watchPositionAsync(



                {



                  accuracy:



                    Location



                      .Accuracy



                      .High,



                  distanceInterval:



                    1,



                  timeInterval:



                    1000,



                },



                (location) => {



                  const {



                    latitude,



                    longitude,



                    accuracy,



                    heading,



                  } =



                    location.coords;



                  if (typeof heading === 'number' && heading >= 0) setGpsHeading(heading);

                  setLocationAccuracy(



                    accuracy ??



                    null



                  );



                  setIsWaitingForLocation(



                    false



                  );



                  // -------------------------------



                  // GPS -> SVG



                  // -------------------------------



                  const position =



                    gpsToMapPosition(



                      latitude,



                      longitude



                    );



                  setIsInsideCampus(



                    position



                      .isInsideCampus



                  );



                  if (



                    !position



                      .isInsideCampus



                  ) {



                    return;



                  }



                  const newPosition =



                    {



                      x:



                        position.x,



                      y:



                        position.y,



                    };



                  setUserPos(



                    newPosition



                  );



                  // -------------------------------



                  // Smooth marker



                  // -------------------------------



                  markerX.value =



                    withTiming(



                      newPosition.x,



                      {



                        duration:



                          600,



                      }



                    );



                  markerY.value =



                    withTiming(



                      newPosition.y,



                      {



                        duration:



                          600,



                      }



                    );



                }



              );



        } catch (error) {



          console.log(



            'Location error:',



            error



          );



          setLocationGranted(



            false



          );



          setIsWaitingForLocation(



            false



          );



        }



      };



    startLocation();



    return () => {



      subscription?.remove();



    };



  }, []);



  // =======================================================



  // CALCULATE EVACUATION DESTINATION



  // =======================================================



const handleCalculateRoute = () => {



  if (!locationGranted) {



    setSelectedEvacuationAreaId(null);



    Alert.alert(



      'Location Required',



      'Please allow location access first.'



    );



    return;



  }



  if (!isInsideCampus) {



    setSelectedEvacuationAreaId(null);



    Alert.alert(



      'Outside Campus',



      'You must be inside the mapped campus area to calculate an evacuation route.'



    );



    return;



  }



const result = calculateShortestPath(userPos);



  if (!result.success) {



    setActiveRoute(null);



    // Hide evacuation area if no route exists.



    setSelectedEvacuationAreaId(null);



    Alert.alert(



      'Route unavailable',



      result.message



    );



    return;



  }



  setActiveRoute(result);

  setIsTestRoute(false);

  setOverviewMode(false);

  mapTilt.value = withTiming(20, {duration: 400});



  // Show the evacuation site ONLY after



  // a successful calculation.



  setSelectedEvacuationAreaId(



  result.evacuationAreaId



);



  // Keep the current GPS position in focus rather than fitting the whole campus.

  focusMapPoint(userPos);

};



  const handleTestNavigation = () => {

    const result = calculateOutdoorRoute(testExit);



    if (!result.success) {

      Alert.alert('Test Route Unavailable', result.message);

      return;

    }



    setActiveRoute(result);

    setIsTestRoute(true);

    setDevPanelExpanded(false);

    setOverviewMode(false);

    mapTilt.value = withTiming(20, {duration: 400});

    setSelectedEvacuationAreaId(result.evacuationAreaId);

    console.log('TEST PATH:', result.path.join(' -> '));

    console.log('TEST DISTANCE (m):', result.distance);



    // Test from home: focus the map on the chosen building exit.

    const startNode = NODES[testExit];

    if (startNode) focusMapPoint(startNode);

  };



  // =======================================================



  // STOP NAVIGATION



  // =======================================================



  const handleStopRoute = () => {



    setActiveRoute(null);

    setIsTestRoute(false);

    setOverviewMode(false);

    mapTilt.value = withTiming(0, {duration: 300});



    // Hide evacuation site again.



    setSelectedEvacuationAreaId(null);



  };



const clampMapTranslation = (



    proposedX: number,



    proposedY: number,



    currentScale: number



  ) => {



    'worklet';



    const userPixelX =



      (userPos.x / 100) * MAP_SIZE;



    const userPixelY =



      (userPos.y / 100) * MAP_SIZE;



    /*



     * IMPORTANT:



     * Navigation still uses MAP_SIZE (1200).



     *



     * Panning limits use CONTEXT_SIZE (1800),



     * so the user can swipe all the way to the



     * light outside-map border.



     */



    const scaledContextSize =



      CONTEXT_SIZE * currentScale;



    const halfScaledContext =



      scaledContextSize / 2;



    let clampedX = proposedX;



    let clampedY = proposedY;



    // =========================================



    // HORIZONTAL LIMIT



    // =========================================



    if (



      scaledContextSize <=



      viewportSize.width



    ) {



      // Entire outside context fits horizontally.



      // Keep it centered.



      clampedX =



        userPixelX -



        MAP_SIZE / 2;



    } else {



      /*



       * mapCenterScreenX is:



       *



       * viewportWidth / 2



       * - userPixelX



       * + translateX



       * + MAP_SIZE / 2



       *



       * The outside context is centered on the



       * same point as the UST map, but extends



       * farther on every side.



       */



      const minX =



        userPixelX -



        MAP_SIZE / 2 +



        viewportSize.width / 2 -



        halfScaledContext;



      const maxX =



        userPixelX -



        MAP_SIZE / 2 -



        viewportSize.width / 2 +



        halfScaledContext;



      clampedX = Math.max(



        minX,



        Math.min(maxX, proposedX)



      );



    }



    // =========================================



    // VERTICAL LIMIT



    // =========================================



    if (



      scaledContextSize <=



      viewportSize.height



    ) {



      // Entire outside context fits vertically.



      // Keep it centered.



      clampedY =



        userPixelY -



        MAP_SIZE / 2;



    } else {



      const minY =



        userPixelY -



        MAP_SIZE / 2 +



        viewportSize.height / 2 -



        halfScaledContext;



      const maxY =



        userPixelY -



        MAP_SIZE / 2 -



        viewportSize.height / 2 +



        halfScaledContext;



      clampedY = Math.max(



        minY,



        Math.min(maxY, proposedY)



      );



    }



    return {



      x: clampedX,



      y: clampedY,



    };



  };



  // Zoom toward a specific map coordinate without altering GPS or node data.

  // The existing pan layer uses userPos as its origin, so adjust translations

  // to put the requested map point at the center of the visible viewport.

  const focusMapPoint = (point: { x: number; y: number }) => {

    const targetScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, 1.45));

    const userPixelX = (userPos.x / 100) * MAP_SIZE;

    const userPixelY = (userPos.y / 100) * MAP_SIZE;

    const pointPixelX = (point.x / 100) * MAP_SIZE;

    const pointPixelY = (point.y / 100) * MAP_SIZE;



    const proposedX =

      userPixelX - MAP_SIZE / 2 -

      (pointPixelX - MAP_SIZE / 2) * targetScale;

    const proposedY =

      userPixelY - MAP_SIZE / 2 -

      (pointPixelY - MAP_SIZE / 2) * targetScale;

    const bounded = clampMapTranslation(proposedX, proposedY, targetScale);



    translateX.value = withSpring(bounded.x);

    translateY.value = withSpring(bounded.y);

    scale.value = withSpring(targetScale);

    savedTranslateX.value = bounded.x;

    savedTranslateY.value = bounded.y;

    savedScale.value = targetScale;

    setZoomDisplay(targetScale);

  };



  // =======================================================



  // PAN



  // =======================================================



  const panGesture = Gesture.Pan()



    .minDistance(8)



    .averageTouches(true)



    .onStart(() => {



      savedTranslateX.value =



        translateX.value;



      savedTranslateY.value =



        translateY.value;



    })



    .onUpdate((event) => {



      const proposedX =



        savedTranslateX.value +



        event.translationX;



      const proposedY =



        savedTranslateY.value +



        event.translationY;



      const clamped =



        clampMapTranslation(



          proposedX,



          proposedY,



          scale.value



        );



      translateX.value =



        clamped.x;



      translateY.value =



        clamped.y;



    })



    .onEnd(() => {



      savedTranslateX.value =



        translateX.value;



      savedTranslateY.value =



        translateY.value;



    });



  // =======================================================



  // PINCH



  // =======================================================



  const pinchGesture = Gesture.Pinch()



    .onStart((event) => {



      savedScale.value = scale.value;



      pinchStartTranslateX.value =



        translateX.value;



      pinchStartTranslateY.value =



        translateY.value;



      const userPixelX =



        (userPos.x / 100) * MAP_SIZE;



      const userPixelY =



        (userPos.y / 100) * MAP_SIZE;



      const mapCenterScreenX =



        viewportSize.width / 2 -



        userPixelX +



        translateX.value +



        MAP_SIZE / 2;



      const mapCenterScreenY =



        viewportSize.height / 2 -



        userPixelY +



        translateY.value +



        MAP_SIZE / 2;



      pinchStartX.value =



        (event.focalX - mapCenterScreenX) /



        scale.value;



      pinchStartY.value =



        (event.focalY - mapCenterScreenY) /



        scale.value;



    })



    .onUpdate((event) => {



      const ZOOM_SENSITIVITY = 0.78;



      const softenedScale =



        1 +



        (event.scale - 1) *



          ZOOM_SENSITIVITY;



      let newScale =



        savedScale.value *



        softenedScale;



      newScale = Math.max(



        MIN_ZOOM,



        Math.min(MAX_ZOOM, newScale)



      );



      const userPixelX =



        (userPos.x / 100) * MAP_SIZE;



      const userPixelY =



        (userPos.y / 100) * MAP_SIZE;



      const proposedX =



        event.focalX -



        (



          viewportSize.width / 2 -



          userPixelX +



          MAP_SIZE / 2



        ) -



        pinchStartX.value *



          newScale;



      const proposedY =



        event.focalY -



        (



          viewportSize.height / 2 -



          userPixelY +



          MAP_SIZE / 2



        ) -



        pinchStartY.value *



          newScale;



      const clamped =



        clampMapTranslation(



          proposedX,



          proposedY,



          newScale



        );



      translateX.value =



        clamped.x;



      translateY.value =



        clamped.y;



      scale.value =



        newScale;



    })



    .onEnd(() => {



      savedScale.value =



        scale.value;



      savedTranslateX.value =



        translateX.value;



      savedTranslateY.value =



        translateY.value;



      runOnJS(setZoomDisplay)(



        Math.round(



          scale.value * 100



        ) / 100



      );



    });



  // =======================================================



  // DOUBLE TAP



  // =======================================================



  const doubleTapGesture = Gesture.Tap()



    .numberOfTaps(2)



    .maxDuration(250)



    .onEnd((event) => {



      const targetScale =



        scale.value >= 1.8



          ? 1



          : Math.min(



              scale.value * 1.8,



              MAX_ZOOM



            );



      const userPixelX =



        (userPos.x / 100) * MAP_SIZE;



      const userPixelY =



        (userPos.y / 100) * MAP_SIZE;



      const mapCenterScreenX =



        viewportSize.width / 2 -



        userPixelX +



        translateX.value +



        MAP_SIZE / 2;



      const mapCenterScreenY =



        viewportSize.height / 2 -



        userPixelY +



        translateY.value +



        MAP_SIZE / 2;



      const localX =



        (event.x - mapCenterScreenX) /



        scale.value;



      const localY =



        (event.y - mapCenterScreenY) /



        scale.value;



      const proposedX =



        event.x -



        (



          viewportSize.width / 2 -



          userPixelX +



          MAP_SIZE / 2



        ) -



        localX * targetScale;



      const proposedY =



        event.y -



        (



          viewportSize.height / 2 -



          userPixelY +



          MAP_SIZE / 2



        ) -



        localY * targetScale;



      const clamped =



        clampMapTranslation(



          proposedX,



          proposedY,



          targetScale



        );



      translateX.value =



        withSpring(clamped.x);



      translateY.value =



        withSpring(clamped.y);



      scale.value =



        withSpring(targetScale);



      savedTranslateX.value =



        clamped.x;



      savedTranslateY.value =



        clamped.y;



      savedScale.value =



        targetScale;



      runOnJS(setZoomDisplay)(



        Math.round(



          targetScale * 100



        ) / 100



      );



    });



  const mapGesture = Gesture.Simultaneous(



    panGesture,



    pinchGesture,



    doubleTapGesture



  );



  // =======================================================



  // RECENTER / NORTH-UP



  // =======================================================



  const handleRecenter = () => {



    translateX.value = withSpring(0);



    translateY.value = withSpring(0);



    savedTranslateX.value = 0;



    savedTranslateY.value = 0;



    scale.value = withSpring(1);



    savedScale.value = 1;



    setZoomDisplay(1);



  };



  const handleFitCampus = () => {



    const horizontalScale =



      viewportSize.width / MAP_SIZE;



    const verticalScale =



      viewportSize.height / MAP_SIZE;



    const fitScale =



      Math.min(



        horizontalScale,



        verticalScale



      ) * 0.9;



    const targetScale =



      Math.max(



        MIN_ZOOM,



        Math.min(



          MAX_ZOOM,



          fitScale



        )



      );



    const userPixelX =



      (userPos.x / 100) *



      MAP_SIZE;



    const userPixelY =



      (userPos.y / 100) *



      MAP_SIZE;



    const targetTranslateX =



      userPixelX -



      MAP_SIZE / 2;



    const targetTranslateY =



      userPixelY -



      MAP_SIZE / 2;



    translateX.value =



      withSpring(targetTranslateX);



    translateY.value =



      withSpring(targetTranslateY);



    scale.value =



      withSpring(targetScale);



    savedTranslateX.value =



      targetTranslateX;



    savedTranslateY.value =



      targetTranslateY;



    savedScale.value =



      targetScale;



    setZoomDisplay(



      Math.round(



        targetScale * 100



      ) / 100



    );



  };



  // =======================================================



  // ZOOM BUTTON HELPER



  // =======================================================



  const zoomAroundViewportCenter = (



    targetScale: number



  ) => {



    const clampedScale =



      Math.max(



        MIN_ZOOM,



        Math.min(



          MAX_ZOOM,



          targetScale



        )



      );



    const userPixelX =



      (userPos.x / 100) *



      MAP_SIZE;



    const userPixelY =



      (userPos.y / 100) *



      MAP_SIZE;



    const anchorX =



      viewportSize.width / 2;



    const anchorY =



      viewportSize.height / 2;



    const mapCenterScreenX =



      anchorX -



      userPixelX +



      translateX.value +



      MAP_SIZE / 2;



    const mapCenterScreenY =



      anchorY -



      userPixelY +



      translateY.value +



      MAP_SIZE / 2;



    const localX =



      (anchorX - mapCenterScreenX) /



      scale.value;



    const localY =



      (anchorY - mapCenterScreenY) /



      scale.value;



    const proposedX =



      anchorX -



      (



        anchorX -



        userPixelX +



        MAP_SIZE / 2



      ) -



      localX *



        clampedScale;



    const proposedY =



      anchorY -



      (



        anchorY -



        userPixelY +



        MAP_SIZE / 2



      ) -



      localY *



        clampedScale;



    const clamped =



      clampMapTranslation(



        proposedX,



        proposedY,



        clampedScale



      );



    translateX.value =



      withSpring(clamped.x);



    translateY.value =



      withSpring(clamped.y);



    scale.value =



      withSpring(clampedScale);



    savedTranslateX.value =



      clamped.x;



    savedTranslateY.value =



      clamped.y;



    savedScale.value =



      clampedScale;



    setZoomDisplay(



      Math.round(



        clampedScale * 100



      ) / 100



    );



  };



  // =======================================================



  // ZOOM +



  // =======================================================



  const handleZoomIn = () => {



    // Multiplicative steps feel more natural than fixed +0.5 jumps.



    zoomAroundViewportCenter(



      scale.value * 1.28



    );



  };



  // =======================================================



  // ZOOM -



  // =======================================================



  const handleZoomOut = () => {



    zoomAroundViewportCenter(



      scale.value / 1.28



    );



  };



  // =======================================================



  // MAP PAN STYLE



  // =======================================================



  const animatedPanStyle =



    useAnimatedStyle(



      () => {



        const userPixelX =



          (



            userPos.x /



            100



          ) *



          MAP_SIZE;



        const userPixelY =



          (



            userPos.y /



            100



          ) *



          MAP_SIZE;



        return {



          transform: [



            {



              translateX:



                viewportSize.width / 2 -



                userPixelX +



                translateX.value,



            },



            {



              translateY:



                viewportSize.height / 2 -



                userPixelY +



                translateY.value,



            },



          ],



        };



      },



      [userPos, viewportSize]



    );



  // =======================================================



  // MAP ZOOM STYLE



  // =======================================================



  const animatedZoomStyle =

    useAnimatedStyle(() => ({

      transform: [

        { perspective: 1500 },

        { scale: scale.value },

        { rotateX: `${mapTilt.value}deg` },

      ],

    }));



  // =======================================================



  // MARKER STYLE



  // =======================================================



  const animatedMarkerStyle =



    useAnimatedStyle(



      () => ({



        left:



          (



            markerX.value /



            100



          ) *



          MAP_SIZE,



        top:



          (



            markerY.value /



            100



          ) *



          MAP_SIZE,



      })



    );



  // Graph distance is a mapped-route estimate, not dynamic turn-by-turn guidance.

  const showRouteOverview = () => {

    setOverviewMode(current => {

      if (!current) {

        mapTilt.value = withTiming(0, {duration: 300});

        handleFitCampus();

      } else {

        mapTilt.value = withTiming(20, {duration: 300});

        const startPoint = isTestRoute ? NODES[testExit] : userPos;

        if (startPoint) focusMapPoint(startPoint);

      }

      return !current;

    });

  };



  // =======================================================



  // STATUS



  // =======================================================



  const getStatus = () => {



    if (



      isWaitingForLocation



    ) {



      return {



        text:



          'Getting location...',



        color:



          '#F59E0B',



      };



    }



    if (



      !locationGranted



    ) {



      return {



        text:



          'Location required',



        color:



          '#EF4444',



      };



    }



    if (



      !isInsideCampus



    ) {



      return {



        text:



          'Outside campus',



        color:



          '#F59E0B',



      };



    }



    return {



      text:



        'Live location',



      color:



        '#22C55E',



    };



  };



  const status =



    getStatus();



  // =======================================================



  // UI



  // =======================================================



  return (



    <GestureHandlerRootView



      style={styles.root}



    >



      <View



        style={



          styles.container



        }



      >



        <StatusBar



          barStyle="dark-content"



          backgroundColor="#FFFFFF"



        />



        {/* ============================================= */}



        {/* MAP                                           */}



        {/* ============================================= */}



        <View



          style={styles.mapViewport}



          onLayout={(event) => {



            const { width, height } =



              event.nativeEvent.layout;



            setViewportSize({



              width,



              height,



            });



          }}



        >



          <GestureDetector



            gesture={



              mapGesture



            }



          >



            <View



              style={



                styles.gestureArea



              }



            >



              <Animated.View



                style={[



                  styles.mapPanLayer,



                  animatedPanStyle,



                ]}



              >



                <Animated.View



                  style={[



                    styles.mapZoomLayer,



                    animatedZoomStyle,



                  ]}



                >



                  {/* =================================== */}



                  {/* CAMPUS SVG                          */}



                  {/* =================================== */}



                  <CampusContext



  mapSize={MAP_SIZE}



/>



                  <UstMapSvg



  width={MAP_SIZE}



  height={MAP_SIZE}



/>



                  {/* Lightweight 2.5D roofs and side walls; use the optimized Android SVG. */}
                  {activeRoute?.success && (
                    <BuildingDepthLayer mapSize={MAP_SIZE} />
                  )}



<CampusFadeOverlay



  mapSize={MAP_SIZE}



/>



<EvacuationAreas



  mapSize={MAP_SIZE}



  activeAreaId={



    selectedEvacuationAreaId



  }



/>



<BuildingLabels



  mapSize={MAP_SIZE}



  zoomLevel={zoomDisplay}



/>



                  {/* =================================== */}



                  {/* ROUTE                               */}



                  {/* =================================== */}



                  {activeRoute &&



                    activeRoute.success && (



                      <Svg



                        width={



                          MAP_SIZE



                        }



                        height={



                          MAP_SIZE



                        }



                        viewBox="0 0 100 100"



                        style={



                          styles.routeOverlay



                        }



                        pointerEvents="none"



                      >



                        {/* ================================= */}



{/* White outline */}



                        <Polyline



                          points={



                            activeRoute



                              .pathString



                          }



                          fill="none"



                          stroke="#FFFFFF"



                          strokeWidth="0.82"



                          strokeLinecap="round"



                          strokeLinejoin="round"



                        />



                        {/* Blue route */}



                        <Polyline



                          points={



                            activeRoute



                              .pathString



                          }



                          fill="none"



                          stroke="#2563EB"



                          strokeWidth="0.44"



                          strokeLinecap="round"



                          strokeLinejoin="round"



                        />



                        {/* Moving directional highlight: animated, thin and subtle. */}

                        <AnimatedPolyline

                          points={activeRoute.pathString}

                          fill="none"

                          stroke="#93C5FD"

                          strokeWidth="0.23"

                          strokeDasharray="1.1 1.1"

                          animatedProps={animatedRouteProps}

                          strokeLinecap="round"

                          strokeLinejoin="round"

                        />

                      </Svg>



                    )}



                  {/* =================================== */}



                  {/* USER LOCATION                       */}



                  {/* =================================== */}



                  {(isInsideCampus || (isTestRoute && activeRoute?.success)) && (

                    <Animated.View

                      pointerEvents="none"

                      style={[

                        styles.userMarker,

                        isTestRoute && activeRoute?.success

                          ? {

                              left: (NODES[testExit].x / 100) * MAP_SIZE,

                              top: (NODES[testExit].y / 100) * MAP_SIZE,

                            }

                          : animatedMarkerStyle,

                      ]}

                    >

                      <View style={styles.accuracyGlow} />

                      <View style={styles.userArrowBadge}>

                        <MaterialCommunityIcons

                          name="navigation"

                          size={22}

                          color="#FFFFFF"

                          style={{

                            transform: [{ rotate: `${isTestRoute ? 0 : (gpsHeading ?? 0)}deg` }],

                          }}

                        />

                      </View>

                    </Animated.View>

                  )}



                </Animated.View>



              </Animated.View>



            </View>



          </GestureDetector>



        </View>



        {/* ============================================= */}



        {activeRoute?.success && (

          <View

            style={[styles.navInstruction, isTestRoute && styles.navInstructionDemo]}

            pointerEvents="box-none"

          >

            <View style={styles.navInstructionLeft}>

              <View style={styles.navDirectionIcon}>

                <MaterialCommunityIcons name="routes" size={18} color="#FFFFFF" />

              </View>

              <View style={{ flex: 1, minWidth: 0 }}>

                <Text style={styles.navInstructionTitle} numberOfLines={1}>

                  Follow the blue route

                </Text>

                <Text

                  style={[styles.navInstructionSub, isTestRoute && styles.navDemoLabel]}

                  numberOfLines={1}

                >

                {isTestRoute ? 'DEMO · Not live · ' : 'To '}

                  {activeRoute.evacuationAreaName}

                </Text>

              </View>

            </View>

            <TouchableOpacity

              accessibilityRole="button"

              accessibilityLabel={overviewMode ? 'Return to navigation view' : 'Show route overview'}

              onPress={showRouteOverview}

              style={styles.navOverviewButton}

              hitSlop={8}

            >

              <Text style={styles.navInstructionDistance}>

                {Math.round(activeRoute.distance)} m

              </Text>

              <MaterialCommunityIcons

                name={overviewMode ? 'crosshairs-gps' : 'fit-to-screen-outline'}

                size={16}

                color="#FFFFFF"

              />

            </TouchableOpacity>

          </View>

        )}



        {/* HEADER                                        */}



        {/* ============================================= */}



        <SafeAreaView



          style={



            styles.headerWrapper



          }



          pointerEvents="box-none"



        >



          <View



            style={



              styles.headerCard



            }



          >



            <View



              style={



                styles.brandContainer



              }



            >



              <View



                style={



                  styles.logoContainer



                }



              >



                <MaterialCommunityIcons



                  name="shield-check"



                  size={20}



                  color="#FFFFFF"



                />



              </View>



              <View>



                <Text



                  style={



                    styles.brand



                  }



                >



                  Toma



                  <Text



                    style={



                      styles.brandAccent



                    }



                  >



                    Safe



                  </Text>



                </Text>



                <Text



                  style={



                    styles.subText



                  }



                >



                  CAMPUS EVACUATION



                </Text>



              </View>



            </View>



            <View



              style={



                styles.mapBadge



              }



            >



              <MaterialCommunityIcons



                name="map-outline"



                size={14}



                color="#2563EB"



              />



              <Text



                style={



                  styles.mapBadgeText



                }



              >



                {isTestRoute && activeRoute?.success ? 'DEMO' : 'MAP'}



              </Text>



            </View>



          </View>



        </SafeAreaView>



        {/* ============================================= */}



        {/* GPS STATUS                                    */}



        {/* ============================================= */}



        {!(isTestRoute && activeRoute?.success) && (

        <View



          style={



            styles.locationStatus



          }



        >



          <View



            style={[



              styles.statusDot,



              {



                backgroundColor:



                  status.color,



              },



            ]}



          />



          <Text



            style={



              styles.locationStatusText



            }



          >



            {status.text}



          </Text>



        </View>



        )}



        {/* ============================================= */}



        {/* ZOOM CONTROLS                                 */}



        {/* ============================================= */}



        <View

          style={[styles.mapControls, { bottom: bottomPanelHeight + 24 }]}

        >

          <TouchableOpacity

            style={styles.controlButton}

            onPress={handleZoomIn}

            hitSlop={6}

            accessibilityRole="button"

            accessibilityLabel="Zoom in"

          >

            <MaterialCommunityIcons name="plus" size={21} color="#334155" />

          </TouchableOpacity>

          <View style={styles.controlDivider} />

          <View style={styles.zoomIndicator}>

            <Text style={styles.zoomIndicatorText}>{zoomDisplay.toFixed(1)}×</Text>

          </View>

          <View style={styles.controlDivider} />

          <TouchableOpacity

            style={styles.controlButton}

            onPress={handleZoomOut}

            hitSlop={6}

            accessibilityRole="button"

            accessibilityLabel="Zoom out"

          >

            <MaterialCommunityIcons name="minus" size={21} color="#334155" />

          </TouchableOpacity>

          <View style={styles.controlDivider} />

          <TouchableOpacity

            style={styles.controlButton}

            onPress={handleRecenter}

            hitSlop={6}

            accessibilityRole="button"

            accessibilityLabel="Recenter map"

          >

            <MaterialCommunityIcons name="crosshairs-gps" size={20} color="#2563EB" />

          </TouchableOpacity>

          <View style={styles.controlDivider} />

          <TouchableOpacity

            style={styles.controlButton}

            onPress={handleFitCampus}

            hitSlop={6}

            accessibilityRole="button"

            accessibilityLabel="Fit campus to screen"

          >

            <MaterialCommunityIcons name="fit-to-screen-outline" size={20} color="#334155" />

          </TouchableOpacity>

        </View>



        {/* ============================================= */}

        {/* COMPACT NAVIGATION CARD                       */}



        {/* ============================================= */}



        <View

          style={styles.bottomPanel}

          onLayout={(event) => {

            const height = event.nativeEvent.layout.height;

            setBottomPanelHeight(previous =>

              Math.abs(previous - height) > 1 ? height : previous

            );

          }}

        >

          {__DEV__ && (

            <View style={styles.testNavigationPanel}>

              <TouchableOpacity

                style={styles.devHeaderRow}

                accessibilityRole="button"

                accessibilityLabel={devPanelExpanded ? 'Collapse test route controls' : 'Expand test route controls'}

                onPress={() => setDevPanelExpanded(open => !open)}

              >

                <MaterialCommunityIcons name="code-tags" size={15} color="#64748B" />

                <Text style={styles.testNavigationHeading}>TEST ROUTE · DEV ONLY</Text>

                <View style={styles.devSelectionBadge}>

                  <Text style={styles.devSelectionText}>{testExit}</Text>

                </View>

                <MaterialCommunityIcons

                  name={devPanelExpanded ? 'chevron-up' : 'chevron-down'}

                  size={18}

                  color="#64748B"

                />

              </TouchableOpacity>

              {devPanelExpanded && (

                <View style={styles.testExitRow}>

                  {(['N2', 'N3', 'N4'] as const).map(id => (

                    <TouchableOpacity

                      key={id}

                      accessibilityRole="button"

                      accessibilityLabel={`Select exit ${id}`}

                      hitSlop={4}

                      onPress={() => setTestExit(id)}

                      style={[

                        styles.testExitButton,

                        testExit === id && styles.testExitButtonSelected,

                      ]}

                    >

                      <Text style={[

                        styles.testExitButtonText,

                        testExit === id && styles.testExitButtonTextSelected,

                      ]}>{id}</Text>

                    </TouchableOpacity>

                  ))}

                  <TouchableOpacity

                    accessibilityRole="button"

                    accessibilityLabel="Show selected test route"

                    onPress={handleTestNavigation}

                    style={styles.testShowRouteButton}

                  >

                    <Text style={styles.testShowRouteText}>SHOW ROUTE</Text>

                  </TouchableOpacity>

                </View>

              )}

            </View>

          )}



          {activeRoute?.success ? (

            <View style={styles.routeInfoRow}>

              <View style={styles.routeIcon}>

                <MaterialCommunityIcons name="flag-checkered" size={19} color="#16834A" />

              </View>

              <View style={styles.routeTextContainer}>

                <Text style={styles.routeLabel}>EVACUATION DESTINATION</Text>

                <Text style={styles.routeTitle} numberOfLines={1}>

                  {activeRoute.evacuationAreaName}

                </Text>

                <Text style={styles.routeDistance}>

                {isTestRoute ? 'Demo route' : 'Mapped route'} · Approx. {Math.round(activeRoute.distance)} m

                </Text>

              </View>

              <TouchableOpacity

                style={styles.stopButton}

                onPress={handleStopRoute}

                accessibilityRole="button"

                accessibilityLabel="Stop navigation"

                hitSlop={5}

              >

                <MaterialCommunityIcons name="close" size={19} color="#DC2626" />

              </TouchableOpacity>

            </View>

          ) : (

            <>

              <View style={styles.compactLocationRow}>

                <View style={styles.compactLocationIcon}>

                  <MaterialCommunityIcons name="crosshairs-gps" size={18} color="#2563EB" />

                </View>

                <View style={styles.compactLocationInfo}>

                  <Text style={styles.compactLocationTitle}>

                    {isInsideCampus ? 'Live Location' : 'Location unavailable'}

                  </Text>

                  <Text style={styles.compactLocationSubtext}>

                    {locationAccuracy !== null

                      ? `GPS accuracy ±${Math.round(locationAccuracy)} m`

                      : 'Waiting for GPS...'}

                  </Text>

                </View>

                <View style={[styles.liveIndicator, { backgroundColor: status.color }]} />

              </View>

              <TouchableOpacity

                style={[

                  styles.routeButton,

                  (!locationGranted || !isInsideCampus) && styles.routeButtonDisabled,

                ]}

                disabled={!locationGranted || !isInsideCampus}

                activeOpacity={0.85}

                onPress={handleCalculateRoute}

                accessibilityRole="button"

                accessibilityLabel="Find evacuation destination"

              >

                <MaterialCommunityIcons name="directions-fork" size={17} color="#FFFFFF" />

                <Text style={styles.routeButtonText}>FIND EVACUATION DESTINATION</Text>

              </TouchableOpacity>

            </>

          )}

        </View>



      </View>



    </GestureHandlerRootView>



  );



}



// =========================================================



// STYLES



// =========================================================



const styles =



  StyleSheet.create({

    // Compact dev controls: exit choices and route button share one row.

    testNavigationPanel: {

      marginBottom: 7, paddingBottom: 7, borderBottomWidth: 1, borderBottomColor: '#E2E8F0',

    },

    testNavigationHeading: {

      flex: 1, fontSize: 9, fontWeight: '800', color: '#64748B', letterSpacing: 0.25,

    },

    testExitRow: {

      flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8,

    },

    testExitButton: {

      flex: 1, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#E9EEF4',

    },

    testExitButtonSelected: {

      backgroundColor: '#2563EB',

    },

    testExitButtonText: {

      fontSize: 11,

      fontWeight: '800',

      color: '#334155',

    },

    testExitButtonTextSelected: {

      color: '#FFFFFF',

    },

    testShowRouteButton: {

      flex: 2, height: 42, backgroundColor: '#16A34A', borderRadius: 10, alignItems: 'center', justifyContent: 'center',

    },

    testShowRouteText: {

      color: '#FFFFFF', fontWeight: '800', fontSize: 10,

    },



    // Compact navigation banner: uses only about 50–55 dp of map height.

    devHeaderRow: {

      flexDirection: 'row', alignItems: 'center', minHeight: 26, gap: 7,

    },

    devSelectionBadge: {

      backgroundColor: '#EFF6FF', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7,

    },

    devSelectionText: {

      fontSize: 9, color: '#2563EB', fontWeight: '900',

    },

    navInstructionDemo: {

      top: 105,

    },

    navDirectionIcon: {

      width: 30, height: 30, borderRadius: 9, alignItems: 'center',

      justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.13)',

    },

    navInstruction: {

      position: 'absolute', top: 134, left: 14, right: 14, minHeight: 52,

      borderRadius: 14, backgroundColor: '#142D4B', paddingHorizontal: 11, paddingVertical: 8,

      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 27, elevation: 6,

    },

    navInstructionLeft: {

      flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9,

    },

    navInstructionTitle: {

      fontSize: 13, lineHeight: 17, fontWeight: '800', color: '#FFFFFF',

    },

    navInstructionSub: {

      fontSize: 9, lineHeight: 12, fontWeight: '600', color: '#CBDDF0', marginTop: 1,

    },

    navDemoLabel: {

      color: '#FDE68A', fontWeight: '800',

    },

    navOverviewButton: {

      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',

      paddingLeft: 9, marginLeft: 8, borderLeftWidth: 1,

      borderLeftColor: 'rgba(255,255,255,0.22)', gap: 6, minHeight: 34,

    },

    navInstructionDistance: {

      color: '#FFFFFF', fontSize: 12, fontWeight: '800',

    },

    userArrowBadge: {

      width: 30, height: 30, borderRadius: 16,

      backgroundColor: '#2563EB', borderWidth: 3, borderColor: '#FFFFFF',

      alignItems: 'center', justifyContent: 'center', elevation: 8,

    },

    root: {



      flex: 1,



    },



    container: {



      flex: 1,



      backgroundColor:



        '#F8FAFC',



    },



    // =====================================================



    // MAP



    // =====================================================



    mapViewport: {



  flex: 1,



  overflow: 'hidden',



  backgroundColor: '#FFFFFF',



},



    gestureArea: {



      flex: 1,



      width: '100%',



      height: '100%',



    },



    mapPanLayer: {



      position: 'absolute',



      width: MAP_SIZE,



      height: MAP_SIZE,



      top: 0,



      left: 0,



    },



    mapZoomLayer: {



      width: MAP_SIZE,



      height: MAP_SIZE,



    },



    routeOverlay: {



      position: 'absolute',



      top: 0,



      left: 0,



    },



    // =====================================================



    // USER MARKER



    // =====================================================



    userMarker: {



      position: 'absolute',



      width: 40,



      height: 40,



      marginLeft: -20,



      marginTop: -20,



      alignItems:



        'center',



      justifyContent:



        'center',



      zIndex: 100,



    },



    accuracyGlow: {



      position:



        'absolute',



      width: 34,



      height: 34,



      borderRadius: 17,



      backgroundColor:



        'rgba(37,99,235,0.15)',



      borderWidth: 1,



      borderColor:



        'rgba(37,99,235,0.20)',



    },



    userDotOuter: {



      width: 18,



      height: 18,



      borderRadius: 9,



      backgroundColor:



        '#FFFFFF',



      alignItems:



        'center',



      justifyContent:



        'center',



      elevation: 9,



    },



    userDot: {



      width: 10,



      height: 10,



      borderRadius: 5,



      backgroundColor:



        '#2563EB',



    },



    // =====================================================



    // HEADER



    // =====================================================



    headerWrapper: {



      position:



        'absolute',



      top: 0,



      left: 0,



      right: 0,



      zIndex: 30,



    },



    headerCard: {

      marginHorizontal: 14, marginTop: 5, minHeight: 50,

      paddingHorizontal: 11, paddingVertical: 6, borderRadius: 15,

      backgroundColor: 'rgba(255,255,255,0.97)',

      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',

      borderWidth: 1, borderColor: '#E2E8F0', elevation: 6,

    },



    brandContainer: {



      flexDirection:



        'row',



      alignItems:



        'center',



    },



    logoContainer: {

      width: 32, height: 32, borderRadius: 10, backgroundColor: '#0F172A',

      alignItems: 'center', justifyContent: 'center', marginRight: 9,

    },



    brand: {

      fontSize: 16, fontWeight: '900', color: '#0F172A',

    },



    brandAccent: {



      color:



        '#2563EB',



    },



    subText: {



      marginTop: 1,



      fontSize: 7,



      fontWeight:



        '800',



      color:



        '#94A3B8',



      letterSpacing: 1,



    },



    mapBadge: {

      flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF',

      paddingHorizontal: 8, paddingVertical: 6, borderRadius: 9,

    },



    mapBadgeText: {



      marginLeft: 4,



      fontSize: 7,



      fontWeight:



        '900',



      color:



        '#2563EB',



    },



    // =====================================================



    // STATUS



    // =====================================================



    locationStatus: {

      position: 'absolute', top: 88, alignSelf: 'center',

      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 5,

      borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.95)',

      borderWidth: 1, borderColor: '#E2E8F0', elevation: 3, zIndex: 25,

    },



    statusDot: {



      width: 7,



      height: 7,



      borderRadius: 4,



      marginRight: 6,



    },



    locationStatusText: {



      fontSize: 10,



      fontWeight:



        '700',



      color:



        '#475569',



    },



    // =====================================================



    // CONTROLS



    // =====================================================



    mapControls: {

      position: 'absolute', right: 14, width: 44, borderRadius: 14,

      backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',

      overflow: 'hidden', elevation: 6, zIndex: 25,

    },



    controlButton: {

      width: 44, height: 44, alignItems: 'center', justifyContent: 'center',

    },



    controlDivider: {



      height: 1,



      marginHorizontal:



        7,



      backgroundColor:



        '#E2E8F0',



    },



    zoomIndicator: {

      height: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC',

    },



    zoomIndicatorText: {

      fontSize: 9, fontWeight: '800', color: '#64748B',

    },



    recenterButton: {



      position:



        'absolute',



      right: 14,



      bottom: 180,



      width: 48,



      height: 48,



      borderRadius: 14,



      backgroundColor:



        '#FFFFFF',



      alignItems:



        'center',



      justifyContent:



        'center',



      borderWidth: 1,



      borderColor:



        '#E2E8F0',



      elevation: 7,



      zIndex: 25,



    },



    fitCampusButton: {



      position: 'absolute',



      right: 14,



      bottom: 123,



      width: 48,



      height: 48,



      borderRadius: 14,



      backgroundColor: '#FFFFFF',



      alignItems: 'center',



      justifyContent: 'center',



      borderWidth: 1,



      borderColor: '#E2E8F0',



      elevation: 7,



      zIndex: 25,



    },



    // =====================================================



    // BOTTOM CARD



    // =====================================================



    bottomPanel: {

      position: 'absolute', bottom: 10, left: 14, right: 14, padding: 10,

      backgroundColor: 'rgba(255,255,255,0.98)', borderRadius: 16,

      borderWidth: 1, borderColor: '#E2E8F0', elevation: 9, zIndex: 20,

    },



    compactLocationRow: {



      flexDirection:



        'row',



      alignItems:



        'center',



    },



    compactLocationIcon: {

      width: 34, height: 34, borderRadius: 10, backgroundColor: '#EFF6FF',

      alignItems: 'center', justifyContent: 'center', marginRight: 9,

    },



    compactLocationInfo: {



      flex: 1,



    },



    compactLocationTitle: {

      fontSize: 12, fontWeight: '800', color: '#0F172A',

    },



    compactLocationSubtext: {



      marginTop: 1,



      fontSize: 9,



      fontWeight:



        '600',



      color:



        '#64748B',



    },



    liveIndicator: {



      width: 8,



      height: 8,



      borderRadius: 4,



      marginLeft: 8,



    },



    // =====================================================



    // ROUTE BUTTON



    // =====================================================



    routeButton: {

      height: 42, marginTop: 8, borderRadius: 11, backgroundColor: '#2563EB',

      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',

    },



    routeButtonDisabled: {



      backgroundColor:



        '#94A3B8',



      opacity: 0.65,



    },



    routeButtonText: {



      marginLeft: 7,



      fontSize: 11,



      fontWeight:



        '900',



      color:



        '#FFFFFF',



      letterSpacing: 0.4,



    },



    // =====================================================



    // ACTIVE ROUTE



    // =====================================================



    routeInfoRow: {



      flexDirection:



        'row',



      alignItems:



        'center',



    },



    routeIcon: {

      width: 36, height: 36, borderRadius: 11, backgroundColor: '#E8F8EE',

      alignItems: 'center', justifyContent: 'center', marginRight: 9,

    },



    routeTextContainer: {



      flex: 1,



    },



    routeLabel: {



      fontSize: 8,



      fontWeight:



        '900',



      color:



        '#94A3B8',



      letterSpacing: 1,



    },



    routeTitle: {

      marginTop: 1, fontSize: 13, fontWeight: '900', color: '#0F172A',

    },



    routeDistance: {

      marginTop: 1, fontSize: 10, fontWeight: '600', color: '#64748B',

    },



    stopButton: {

      width: 44, height: 44, borderRadius: 12, backgroundColor: '#FEF2F2',

      alignItems: 'center', justifyContent: 'center', marginLeft: 8,

    },



  });
