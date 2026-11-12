import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function Navigation() {
  const { userId } = useLocalSearchParams();//retreive user Id from url parameters
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { bottom: Math.max(insets.bottom, 12) + 8 }]}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ selected: pathname === '/home' }}
        accessibilityLabel="Home"
        style={[styles.navButton, pathname === '/home' && styles.activeIcon]}
        onPress={() =>
        router.push({
          pathname: '/home',
          params: { userId: userId ? String(userId) : '1001' },
        })
      }
      >
        <Image source={require('../../assets/navIcon/home.png')} style={styles.icon} />
        <Text style={[styles.buttonText, pathname === `/home/${userId}` && styles.activeText]}>Home</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ selected: pathname === '/session' }}
        accessibilityLabel="Sessions"
        style={[styles.navButton, pathname === '/session' && styles.activeIcon]}
        onPress={() =>
          router.push({
            pathname: '/session',
            params: { userId: userId ? String(userId) : '1001' },
          })
        }
      >
        <Image source={require('../../assets/navIcon/session.png')} style={styles.icon} />
        <Text style={[styles.buttonText, pathname === '/session' && styles.activeText]}>Session</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ selected: pathname === '/messages' }}
        accessibilityLabel="Messages"
        style={[styles.navButton, pathname === '/messages' && styles.activeIcon]}
        onPress={() =>
          router.push({
            pathname: '/messages',
            params: { userId: userId ? String(userId) : '1001' },
          })
        }
      >
        <Image source={require('../../assets/headerIcon/message.png')} style={styles.icon} />
        <Text style={[styles.buttonText, pathname === '/messages' && styles.activeText]}>Messages</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ selected: pathname === '/wallet' }}
        accessibilityLabel="Wallet"
        style={[styles.navButton, pathname === '/wallet' && styles.activeIcon]}
        onPress={() =>
          router.push({
            pathname: '/wallet',
            params: { userId: userId ? String(userId) : '1001' },
          })
        }
      >
        <Image source={require('../../assets/navIcon/wallet.png')} style={styles.icon} />
        <Text style={[styles.buttonText, pathname === `/wallet/${userId}` && styles.activeText]}>Wallet</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ selected: pathname === '/profile' }}
        accessibilityLabel="Profile"
        style={[styles.navButton, pathname === '/profile' && styles.activeIcon]}
        onPress={() =>
          router.push({
            pathname: '/profile',
            params: { userId: userId ? String(userId) : '1001' },
          })
        }
      >
        <Image source={require('../../assets/navIcon/profile.png')} style={styles.icon} />
        <Text style={[styles.buttonText, pathname === `/profile/${userId}` && styles.activeText]}>Profile</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFCF6',
    borderRadius: 22,
    paddingHorizontal: 5,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#EAE3D8',
    elevation: 10,
    shadowColor: '#28263D',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 5 },
  },
  buttonText: {
    color: '#7C8178',
    fontSize: 10,
    fontWeight: '700',
  },
  icon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  activeIcon: {
    backgroundColor: '#F9E4DC',
  },
  navButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  activeText: {
    color: '#B84E38',
    fontWeight: '800',
  },
});