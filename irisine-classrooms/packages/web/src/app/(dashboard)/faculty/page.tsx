import { UserDirectory } from '@/components/user-directory';

/** The school's own faculty screen. The IT Admin menu uses /it-admin/faculty for the same list. */
export default function SchoolFacultyPage() {
  return <UserDirectory facultyOnly />;
}
