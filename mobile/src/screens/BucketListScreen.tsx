/**
 * BucketListScreen – Destination Bucket List
 *
 * Mirrors the BucketListAgent in wanderplan-bucket-list-agent.jsx.
 * Users can browse and add dream destinations.
 */
import React, {useState, useCallback, useEffect} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Image,
  Alert,
  SafeAreaView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import {Colors, Radii, Shadows, Spacing, Typography} from '../constants/theme';
import Button from '../components/Button';
import {
  listBucketItems,
  addBucketItem,
  removeBucketItem,
  BucketItem,
} from '../services/api';

// ---------------------------------------------------------------------------
// Demo data – shown when offline
// ---------------------------------------------------------------------------
const DEMO_ITEMS: BucketItem[] = [
  {
    id: 'b1',
    destination: 'Santorini, Greece',
    country: 'Greece',
    photo:
      'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=600&q=80',
    notes: 'Sunset from Oia cliffs 🌅',
    addedAt: '2024-11-01',
    priority: 'high',
  },
  {
    id: 'b2',
    destination: 'Kyoto, Japan',
    country: 'Japan',
    photo:
      'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600&q=80',
    notes: 'Cherry blossom season 🌸',
    addedAt: '2024-10-15',
    priority: 'high',
  },
  {
    id: 'b3',
    destination: 'Patagonia, Argentina',
    country: 'Argentina',
    photo:
      'https://images.unsplash.com/photo-1591519491-2cfab4f06d7f?w=600&q=80',
    notes: 'Torres del Paine trekking 🏔',
    addedAt: '2024-09-22',
    priority: 'medium',
  },
  {
    id: 'b4',
    destination: 'Marrakech, Morocco',
    country: 'Morocco',
    photo:
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
    notes: 'Medina & souks 🕌',
    addedAt: '2024-09-01',
    priority: 'medium',
  },
];

const PRIORITY_COLOR: Record<BucketItem['priority'], string> = {
  high: Colors.secondary,
  medium: Colors.warning,
  low: Colors.success,
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function BucketListScreen() {
  const [items, setItems] = useState<BucketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newDest, setNewDest] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const fetched = await listBucketItems();
      setItems(fetched.length > 0 ? fetched : DEMO_ITEMS);
    } catch {
      setItems(DEMO_ITEMS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  async function handleAdd() {
    if (!newDest.trim()) return;
    setAdding(true);
    try {
      const item = await addBucketItem(newDest.trim(), newNotes.trim());
      setItems(prev => [item, ...prev]);
      setNewDest('');
      setNewNotes('');
      setModalVisible(false);
    } catch {
      // Optimistic add for offline use
      const optimistic: BucketItem = {
        id: `tmp-${Date.now()}`,
        destination: newDest.trim(),
        notes: newNotes.trim(),
        addedAt: new Date().toISOString().slice(0, 10),
        priority: 'medium',
      };
      setItems(prev => [optimistic, ...prev]);
      setNewDest('');
      setNewNotes('');
      setModalVisible(false);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(item: BucketItem) {
    Alert.alert(
      'Remove destination',
      `Remove "${item.destination}" from your bucket list?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setItems(prev => prev.filter(i => i.id !== item.id));
            try {
              await removeBucketItem(item.id);
            } catch {
              // Silently ignore if offline – UI is already updated
            }
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={items}
        keyExtractor={i => i.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Bucket List</Text>
              <Text style={styles.headerSub}>
                {items.length} destination{items.length !== 1 ? 's' : ''} to
                explore
              </Text>
            </View>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => setModalVisible(true)}
              activeOpacity={0.8}>
              <Text style={styles.addBtnText}>+ Add</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({item}) => (
          <BucketCard
            item={item}
            onRemove={() => handleRemove(item)}
          />
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🌍</Text>
              <Text style={styles.emptyTitle}>Your bucket list is empty</Text>
              <Text style={styles.emptyBody}>
                Add the destinations you dream about visiting.
              </Text>
            </View>
          ) : null
        }
      />

      {/* Add destination modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modal}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Add destination</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Destination *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Bali, Indonesia"
              placeholderTextColor={Colors.text3}
              value={newDest}
              onChangeText={setNewDest}
              autoFocus
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Things you want to do there…"
              placeholderTextColor={Colors.text3}
              value={newNotes}
              onChangeText={setNewNotes}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.modalActions}>
            <Button
              label="Cancel"
              variant="outline"
              onPress={() => {
                setNewDest('');
                setNewNotes('');
                setModalVisible(false);
              }}
              style={styles.modalBtn}
            />
            <Button
              label="Add to list"
              onPress={handleAdd}
              loading={adding}
              disabled={!newDest.trim()}
              style={styles.modalBtn}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// BucketCard
// ---------------------------------------------------------------------------

function BucketCard({
  item,
  onRemove,
}: {
  item: BucketItem;
  onRemove: () => void;
}) {
  const PLACEHOLDER =
    'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&q=80';

  return (
    <View style={cardStyles.card}>
      <Image
        source={{uri: item.photo ?? PLACEHOLDER}}
        style={cardStyles.image}
        resizeMode="cover"
      />
      <View
        style={[
          cardStyles.priorityBar,
          {backgroundColor: PRIORITY_COLOR[item.priority]},
        ]}
      />
      <View style={cardStyles.body}>
        <View style={cardStyles.row}>
          <Text style={cardStyles.dest} numberOfLines={1}>
            {item.destination}
          </Text>
          <TouchableOpacity
            hitSlop={{top: 8, right: 8, bottom: 8, left: 8}}
            onPress={onRemove}>
            <Text style={cardStyles.removeIcon}>✕</Text>
          </TouchableOpacity>
        </View>
        {item.notes ? (
          <Text style={cardStyles.notes} numberOfLines={2}>
            {item.notes}
          </Text>
        ) : null}
        <Text style={cardStyles.date}>Added {item.addedAt}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    ...Shadows.md,
  },
  image: {width: '100%', height: 130},
  priorityBar: {height: 3},
  body: {padding: Spacing.md},
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  dest: {
    flex: 1,
    fontSize: Typography.md,
    fontWeight: '700',
    color: Colors.text,
    marginRight: Spacing.sm,
  },
  removeIcon: {
    fontSize: 14,
    color: Colors.text3,
  },
  notes: {
    fontSize: Typography.sm,
    color: Colors.text2,
    marginBottom: 4,
    lineHeight: 20,
  },
  date: {
    fontSize: Typography.xs,
    color: Colors.text3,
  },
});

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: Colors.bg},
  list: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    marginTop: Spacing.sm,
  },
  headerTitle: {
    fontSize: Typography.xl,
    fontWeight: '800',
    color: Colors.text,
  },
  headerSub: {
    fontSize: Typography.sm,
    color: Colors.text2,
    marginTop: 2,
  },
  addBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.full,
  },
  addBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: Typography.sm,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyIcon: {fontSize: 56, marginBottom: Spacing.md},
  emptyTitle: {
    fontSize: Typography.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  emptyBody: {
    fontSize: Typography.sm,
    color: Colors.text2,
    textAlign: 'center',
  },
  // Modal
  modal: {
    flex: 1,
    backgroundColor: Colors.bg,
    padding: Spacing.xl,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: Typography.xl,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  field: {gap: 6, marginBottom: Spacing.md},
  label: {
    fontSize: Typography.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: Typography.base,
    color: Colors.text,
    backgroundColor: Colors.surface,
  },
  inputMultiline: {
    height: 90,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  modalBtn: {flex: 1},
});
