import { Redirect, useLocalSearchParams } from "expo-router";

export default function UidRedirect() {
  const params = useLocalSearchParams<{ uid?: string | string[] }>();
  const uid = Array.isArray(params.uid) ? params.uid[0] : params.uid;

  if (!uid) {
    return <Redirect href="/" />;
  }

  return <Redirect href={{ pathname: "/(tabs)/uid", params: { uid } }} />;
}
