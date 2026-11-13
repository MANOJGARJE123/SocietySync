import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import NoticesScreen from '../screens/NoticesScreen';
import ComplaintsScreen from '../screens/ComplaintsScreen';
import MaintenanceScreen from '../screens/MaintenanceScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SocietyScreen from '../screens/SocietyScreen';
import UsersScreen from '../screens/UsersScreen';
import WingRequestsScreen from '../screens/WingRequestsScreen';
import AdminPanelScreen from '../screens/AdminPanelScreen';
import SocietyDetailsScreen from '../screens/SocietyDetailsScreen';
import { COLORS, SPACING } from '../constants/theme';
import { ROLES } from '../constants/app';
import { useAuth } from '../context/AuthContext';
import { useResponsive } from '../hooks/useResponsive';
import ChatFab from '../components/ChatFab';
import ChatAssistantModal from '../components/ChatAssistantModal';
import SideBar from './SideBar';

const Drawer = createDrawerNavigator();
const Stack = createNativeStackNavigator();

const AdminStackNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="AdminList" component={AdminPanelScreen} />
      <Stack.Screen name="SocietyDetails" component={SocietyDetailsScreen} />
    </Stack.Navigator>
  );
};

const routeOptions = {
  Home: { component: HomeScreen, title: 'Home' },
  Notices: { component: NoticesScreen, title: 'Notices' },
  Complaints: { component: ComplaintsScreen, title: 'Complaints' },
  Maintenance: { component: MaintenanceScreen, title: 'Maintenance' },
  Society: { component: SocietyScreen, title: 'Society Setup' },
  Users: { component: UsersScreen, title: 'Users' },
  Wing: { component: WingRequestsScreen, title: 'Wing Requests' },
  Admin: { component: AdminStackNavigator, title: 'Admin Panel' },
  Profile: { component: ProfileScreen, title: 'Profile' }
};

const MobileHeaderLeft = ({ navigation, isDrawerOpen }) => {
  return (
    <Pressable onPress={() => navigation.toggleDrawer()} style={styles.menuButton}>
      <Ionicons name={isDrawerOpen ? 'close' : 'menu'} size={22} color={COLORS.textPrimary} />
    </Pressable>
  );
};

const MainTabs = () => {
  const [chatOpen, setChatOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { user } = useAuth();
  const { isMobile, isTablet } = useResponsive();
  const isCompactNav = isMobile || isTablet;
  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === ROLES.ADMIN || isSuperAdmin;
  const isSecretary = user?.role === ROLES.SECRETARY;
  const isPendingResident = user?.role === ROLES.RESIDENT && user?.wingStatus !== 'approved';

  const screens = useMemo(() => {
    if (isPendingResident) {
      return ['Profile'];
    }

    const base = ['Home', 'Notices', 'Complaints', 'Maintenance'];
    if (isAdmin) {
      base.push('Admin', 'Society', 'Users');
    }
    if (isSecretary) {
      base.push('Wing');
    }
    base.push('Profile');
    return base;
  }, [isAdmin, isSecretary, isPendingResident, isSuperAdmin]);

  return (
    <View style={styles.shell}>
      <Drawer.Navigator
        key={user?.role || 'role'}
        useLegacyImplementation={false}
        drawerContent={(props) => <SideBar {...props} isMobile={isCompactNav} />}
        screenListeners={{
          drawerOpen: () => setIsDrawerOpen(true),
          drawerClose: () => setIsDrawerOpen(false)
        }}
        screenOptions={({ navigation, route }) => ({
          headerShown: isCompactNav,
          headerStyle: styles.mobileHeader,
          headerShadowVisible: true,
          headerTintColor: COLORS.textPrimary,
          headerTitle: routeOptions[route.name]?.title || route.name,
          headerTitleStyle: styles.mobileHeaderTitle,
          headerLeft: () => <MobileHeaderLeft navigation={navigation} isDrawerOpen={isDrawerOpen} />,
          sceneContainerStyle: styles.scene,
          drawerType: isCompactNav ? 'front' : 'permanent',
          drawerStyle: styles.drawer,
          overlayColor: isCompactNav ? COLORS.overlay : 'transparent',
          drawerActiveBackgroundColor: 'transparent',
          swipeEnabled: isCompactNav,
          swipeEdgeWidth: isCompactNav ? 40 : 0
        })}
      >
        {screens.map((screenName) => {
          const config = routeOptions[screenName];
          return (
            <Drawer.Screen
              key={screenName}
              name={screenName}
              component={config.component}
              options={{
                title: config.title
              }}
            />
          );
        })}
      </Drawer.Navigator>

      {!isPendingResident ? <ChatFab onPress={() => setChatOpen(true)} /> : null}
      {!isPendingResident ? <ChatAssistantModal visible={chatOpen} onClose={() => setChatOpen(false)} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: COLORS.bg
  },
  drawer: {
    width: Platform.OS === 'web' ? 240 : 220,
    backgroundColor: COLORS.sidebar,
    borderRightWidth: 1,
    borderRightColor: COLORS.borderStrong
  },
  scene: {
    backgroundColor: COLORS.bg,
    overflow: 'hidden'
  },
  mobileHeader: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    elevation: 0,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }
  },
  mobileHeaderTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700'
  },
  menuButton: {
    marginLeft: Platform.OS === 'web' ? SPACING.md : 4,
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : null)
  }
});

export default MainTabs;
