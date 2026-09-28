import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

export function NotFound() {
  return (
    <Card>
      <EmptyState
        icon={<Compass size={24} />}
        title="Page not found"
        description="The page you're looking for doesn't exist or may have moved."
        action={
          <Link to="/">
            <Button>Back to Dashboard</Button>
          </Link>
        }
      />
    </Card>
  );
}
