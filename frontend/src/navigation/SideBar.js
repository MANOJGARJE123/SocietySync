import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { Feather, Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { useAuth } from '../context/AuthContext';

const getInitials = (name) =>
  String(name || 'User')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

const labelByRoute = {
  Home: 'Home',
  Notices: 'Notices',
  Complaints: 'Complaints',
  Maintenance: 'Maintenance',
  Admin: 'Admin Panel',
  Society: 'Society Setup',
  Users: 'Users',
  Wing: 'Wing Requests',
  Profile: 'Profile'
};

const iconByRoute = {
  Home: 'home',
  Notices: 'bell',
  Complaints: 'alert-circle',
  Maintenance: 'credit-card',
  Admin: 'settings',
  Society: 'grid',
  Users: 'users',
  Wing: 'layers',
  Profile: 'user'
};

const NAV_SECTIONS = [
  { title: 'Main', routes: ['Home', 'Notices', 'Complaints', 'Maintenance'] },
  { title: 'Management', routes: ['Users', 'Society', 'Admin', 'Wing'] },
  { title: 'Account', routes: ['Profile'] }
];

const SideBar = ({ state, navigation, isMobile }) => {
  const { signOut, user } = useAuth();
  const [hoveredRoute, setHoveredRoute] = useState('');

  return (
    <DrawerContentScrollView
      contentContainerStyle={styles.scrollContent}
      style={styles.container}
      drawerContentContainerStyle={styles.container}
    >
      <View>
        <View style={styles.brandRow}>
          <View style={styles.logoIcon}>
            <Ionicons name="business-outline" size={18} color={COLORS.white} />
          </View>
          <View>
            <Text style={styles.brandName}>Labdhi Corner</Text>
            <Text style={styles.brandSubtext}>Society workspace</Text>
          </View>
        </View>

        <View style={styles.separator} />

        <View style={styles.navList}>
          {NAV_SECTIONS.map((section) => {
            const visibleRoutes = section.routes
              .map((name) => state.routes.find((route) => route.name === name))
              .filter(Boolean);

            if (visibleRoutes.length === 0) return null;

            return (
              <View key={section.title} style={styles.navSection}>
                <Text style={styles.navSectionTitle}>{section.title}</Text>
                {visibleRoutes.map((route) => {
                  const isActive = state.routes[state.index]?.name === route.name;
                  return (
                    <Pressable
                      key={route.key}
                      onPress={() => {
                        navigation.navigate(route.name);
                        if (isMobile) navigation.closeDrawer();
                      }}
                      onHoverIn={() => setHoveredRoute(route.name)}
                      onHoverOut={() => setHoveredRoute('')}
                      style={[
                        styles.navItem,
                        hoveredRoute === route.name && styles.navItemHover,
                        isActive && styles.navItemActive
                      ]}
                    >
                      <Feather
                        name={iconByRoute[route.name] || 'circle'}
                        size={Platform.OS === 'web' ? 17 : 16}
                        color={isActive ? COLORS.accent : COLORS.textSecondary}
                      />
                      <Text style={[styles.navText, isActive && styles.navTextActive]}>
                        {labelByRoute[route.name] || route.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            );
          })}

          <View style={styles.navSection}>
            <Text style={styles.navSectionTitle}>Account</Text>
            <Pressable
              onPress={signOut}
              onHoverIn={() => setHoveredRoute('logout')}
              onHoverOut={() => setHoveredRoute('')}
              style={[styles.navItem, hoveredRoute === 'logout' && styles.navItemHover]}
            >
              <Feather name="log-out" size={Platform.OS === 'web' ? 17 : 16} color={COLORS.coral} />
              <Text style={[styles.navText, styles.navTextDanger]}>Logout</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View>
        <View style={styles.separator} />

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(user?.name)}</Text>
          </View>
          <View style={styles.userMeta}>
            <Text style={styles.userName}>{user?.name || 'Resident'}</Text>
            <Text style={styles.userRole}>{user?.role || 'Resident'}</Text>
          </View>
        </View>
      </View>
    </DrawerContentScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.sidebar
  },
  scrollContent: {
    flex: 1,
    width: Platform.OS === 'web' ? 236 : 216,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
    justifyContent: 'space-between'
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs
  },
  logoIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center'
  },
  brandName: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary
  },
  brandSubtext: {
    color: COLORS.textSecondary,
    fontSize: 11
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: Platform.OS === 'web' ? SPACING.md : SPACING.sm
  },
  navList: {
    gap: SPACING.sm
  },
  navSection: {
    gap: 4,
    marginBottom: SPACING.sm
  },
  navSectionTitle: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: COLORS.textTertiary,
    fontWeight: '700',
    marginBottom: 6
  },
  navItem: {
    minHeight: 44,
    borderRadius: 10,
    paddingHorizontal: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    ...(Platform.OS === 'web' ? { cursor: 'pointer', transitionDuration: '180ms' } : null)
  },
  navItemHover: {
    backgroundColor: COLORS.surfaceAlt,
    borderColor: COLORS.border
  },
  navItemActive: {
    backgroundColor: COLORS.surfaceAlt,
    borderColor: COLORS.border,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accent,
    paddingLeft: SPACING.sm - 2
  },
  navText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600'
  },
  navTextActive: {
    color: COLORS.textPrimary
  },
  navTextDanger: {
    color: COLORS.coral
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  avatarText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700'
  },
  userMeta: {
    flex: 1
  },
  userName: {
    color: COLORS.textPrimary,
    fontWeight: '600'
  },
  userRole: {
    color: COLORS.textTertiary,
    fontSize: 12,
    marginTop: 2,
    textTransform: 'capitalize'
  }
});

export default SideBar;
