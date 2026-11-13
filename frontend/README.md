# Society Management Mobile App (Expo)

Production-ready React Native mobile app for Society Management System.

## 1. Project Setup

1. Install dependencies:

```bash
cd frontend
npm install
```

2. Start Expo:

```bash
npm run start
```

3. Run on specific platform:

```bash
npm run android
npm run ios
npm run web
```

## 2. Folder Structure

```text
src/
	screens/
		LoginScreen.js
		RegisterScreen.js
		HomeScreen.js
		NoticesScreen.js
		ComplaintsScreen.js
		MaintenanceScreen.js
		ProfileScreen.js
		ChatScreen.js
	components/
		ScreenContainer.js
		AppCard.js
		AppButton.js
		AppInput.js
		EmptyState.js
		StatusBadge.js
		LoadingOverlay.js
	navigation/
		RootNavigator.js
		AuthNavigator.js
		MainTabs.js
	services/
		apiClient.js
		authService.js
		noticeService.js
		complaintService.js
		maintenanceService.js
		ragService.js
	context/
		AuthContext.js
	utils/
		validators.js
		date.js
		error.js
		toast.js
	constants/
		theme.js
		api.js
		app.js
```

## 3. Navigation

- Root navigation in `src/navigation/RootNavigator.js`.
- Auth flow stack in `src/navigation/AuthNavigator.js`.
- Main tab flow in `src/navigation/MainTabs.js` with tabs:
	- Home
	- Notices
	- Complaints
	- Maintenance
	- Chat
	- Profile

## 4. Screens and Features

- `LoginScreen`: JWT login with validation.
- `RegisterScreen`: register as member/admin with validation.
- `HomeScreen`: welcome + quick stats (notices, pending complaints, maintenance dues).
- `NoticesScreen`: list notices, admin can create notice.
- `ComplaintsScreen`: member create/view own complaints, admin view all and resolve.
- `MaintenanceScreen`: member view/pay dues, admin create dues.
- `ProfileScreen`: view and update profile, logout.
- `ChatScreen`: RAG assistant chat UI with bubble conversation style.

## 5. API Integration

- Axios client: `src/services/apiClient.js`
	- Base URL defaults:
		- iOS simulator + web: `http://localhost:5050/api`
		- Android emulator: `http://10.0.2.2:5050/api`
	- For physical devices or custom hosts, set `EXPO_PUBLIC_API_URL`.
	- JWT is auto-attached from AsyncStorage.

- Service functions implemented:
	- `login`
	- `register`
	- `getProfile`
	- `getNotices`
	- `createComplaint`
	- `getComplaints`
	- `createMaintenance`
	- `payMaintenance`
	- `ragQuery`

## 6. Auth and Storage

- Auth context: `src/context/AuthContext.js`
- Stores token in AsyncStorage.
- Auto-login on app launch if token exists.
- Logout clears token and user.

## 7. UX Enhancements Included

- Gradient background and card UI.
- Rounded corners and shadows.
- Reusable `Card`, `Button`, `Input` components.
- Loading states and empty states.
- Toast messages for API success/error.
- Role-based actions for admin vs member.

## 8. Important Note for Real Devices

Set `EXPO_PUBLIC_API_URL` to your machine's LAN IP, for example:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.10:5050/api npm run start
```
