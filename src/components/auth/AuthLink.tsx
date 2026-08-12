import { colors, typography } from '@/constants/theme';
import { Link, LinkProps } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

interface AuthLinkProps extends LinkProps {
  label: string;
}

export function AuthLink({ label, ...props }: AuthLinkProps) {
  return (
    <Link {...props}>
      <Text style={styles.link}>{label}</Text>
    </Link>
  );
}

const styles = StyleSheet.create({
  link: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
});
