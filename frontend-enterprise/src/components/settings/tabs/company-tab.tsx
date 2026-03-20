'use client';

import { useCallback } from 'react';
import { UseMutationResult } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface CompanyTabProps {
  company?: any;
  updateMutation: UseMutationResult<any, Error, any, unknown>;
  t: (key: string) => string;
}

export default function CompanyTab({
  company,
  updateMutation,
  t,
}: CompanyTabProps) {
  const handleSave = useCallback(() => {
    toast.success(t('common.saveChanges'));
  }, [t]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.company.title')}</CardTitle>
        <CardDescription>{t('settings.company.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium">{t('settings.company.name')}</label>
            <input
              type="text"
              defaultValue={company?.name || ''}
              className="w-full mt-1 px-4 py-2 border rounded-lg bg-background"
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t('settings.company.slug')}</label>
            <input
              type="text"
              defaultValue={company?.slug || ''}
              className="w-full mt-1 px-4 py-2 border rounded-lg bg-background"
              disabled
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t('settings.company.website')}</label>
            <input
              type="url"
              defaultValue={company?.website || ''}
              placeholder={t('settings.company.websitePlaceholder')}
              className="w-full mt-1 px-4 py-2 border rounded-lg bg-background"
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t('settings.company.industry')}</label>
            <select
              defaultValue={company?.industry || ''}
              className="w-full mt-1 px-4 py-2 border rounded-lg bg-background"
            >
              <option value="">{t('settings.company.industryPlaceholder')}</option>
              <option value="technology">{t('settings.company.industries.technology')}</option>
              <option value="retail">{t('settings.company.industries.retail')}</option>
              <option value="services">{t('settings.company.industries.services')}</option>
              <option value="healthcare">
                {t('settings.company.industries.healthcare')}
              </option>
              <option value="finance">{t('settings.company.industries.finance')}</option>
              <option value="education">{t('settings.company.industries.education')}</option>
              <option value="other">{t('settings.company.industries.other')}</option>
            </select>
          </div>
        </div>
        <Button onClick={handleSave}>
          <Save className="mr-2 h-4 w-4" />
          {t('common.saveChanges')}
        </Button>
      </CardContent>
    </Card>
  );
}
