import React from 'react';
import { View, StyleSheet } from 'react-native';

export function SparklingAtmosphere() {
  return (
    <View style={styles.container}>
      {/* Pure solid black background - unified color */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000000' }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
});
