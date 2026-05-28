import { useAuth } from "./authContext";
import { ROLES } from "./roles";

// Zentralisierte Rollen-Booleans aus useAuth(). isStaff = Admin ODER Lehrer
// (vereinheitlicht das frueher als "isStaff"/"canManage" duplizierte Konzept).
export function useRoleFlags() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole(ROLES.ADMIN);
  const isTeacher = hasRole(ROLES.TEACHER);
  const isStudent = hasRole(ROLES.STUDENT);
  return { isAdmin, isTeacher, isStudent, isStaff: isAdmin || isTeacher };
}
