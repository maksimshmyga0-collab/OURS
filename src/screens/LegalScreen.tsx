import React from 'react';
import { ChevronLeft, Shield, FileText } from 'lucide-react';
import { OursLogo } from '../components/OursLogo';

export type LegalDocumentType = 'terms' | 'privacy';

export interface LegalScreenProps {
  document: LegalDocumentType | null;
  onClose: () => void;
}

export const LegalScreen: React.FC<LegalScreenProps> = ({
  document,
  onClose,
}) => {
  if (!document) return null;

  const isTerms = document === 'terms';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#FFF9FA] dark:bg-[#000000] text-[#343033] dark:text-[#FFFFFF] animate-sheet-enter overflow-hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-10 bg-[#FFF9FA]/92 dark:bg-[#000000]/92 backdrop-blur-xl border-b border-[#000000]/6 dark:border-[#242024] px-4 h-[56px] flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 py-1.5 px-3 -ml-2 rounded-full bg-white/80 dark:bg-[#1E1C1E] border border-[#EBE3E5] dark:border-[#242024] text-xs font-semibold text-[#343033] dark:text-white hover:bg-white dark:hover:bg-[#252225] active:scale-[0.97] transition-all cursor-pointer shadow-2xs"
        >
          <ChevronLeft size={16} className="text-[#E98787] dark:text-[#F0B9C6]" />
          <span>Назад</span>
        </button>

        <div className="flex items-center gap-2 select-none">
          <OursLogo size={32} className="shrink-0" />
          <span className="font-display font-bold text-sm tracking-wide text-[#343033] dark:text-white">
            OURS
          </span>
        </div>

        <div className="w-16 flex justify-end">
          <div className="w-8 h-8 rounded-full bg-[#FAF0F2] dark:bg-[#201518] flex items-center justify-center text-[#E98787] dark:text-[#F0B9C6]">
            {isTerms ? <FileText size={16} /> : <Shield size={16} />}
          </div>
        </div>
      </header>

      {/* Scrollable Document Content */}
      <main className="flex-1 overflow-y-auto px-5 sm:px-8 py-6 max-w-2xl mx-auto w-full space-y-6 text-sm leading-relaxed text-[#4A4549] dark:text-[#D1CBD0]">
        {isTerms ? (
          /* ================= ПОЛЬЗОВАТЕЛЬСКОЕ СОГЛАШЕНИЕ ================= */
          <article className="space-y-6 pb-12">
            <div className="space-y-2 border-b border-[#EBE3E5] dark:border-[#242024] pb-5">
              <span className="text-[11px] font-bold tracking-wider uppercase text-[#E98787] dark:text-[#F0B9C6] px-2.5 py-1 rounded-full bg-[#FAF0F2] dark:bg-[#251720] border border-[#EED7DC]/70 dark:border-[#382329] inline-block mb-1">
                Юридический документ
              </span>
              <h1 className="font-display text-xl sm:text-2xl font-bold text-[#343033] dark:text-white tracking-tight leading-snug">
                ПОЛЬЗОВАТЕЛЬСКОЕ СОГЛАШЕНИЕ ПРИЛОЖЕНИЯ OURS
              </h1>
              <p className="text-xs text-[#777277] dark:text-[#B8B2B5]">
                Дата вступления в силу: 27.09.2026
              </p>
            </div>

            <p>
              Настоящее Пользовательское соглашение (далее — «Соглашение») регулирует
              использование мобильного приложения <strong>OURS</strong> (далее — «Приложение»).
            </p>
            <p>
              Используя OURS, пользователь подтверждает, что ознакомился с настоящим
              Соглашением и принимает его условия.
            </p>

            <section className="space-y-3 pt-2">
              <h2 className="font-display text-base font-bold text-[#343033] dark:text-white">
                1. О приложении OURS
              </h2>
              <p>
                OURS — мобильное приложение для пар, предназначенное для создания и
                сохранения совместных моментов.
              </p>
              <p>С помощью OURS пользователи могут:</p>
              <ul className="list-disc pl-5 space-y-1.5 marker:text-[#E98787]">
                <li>создать или присоединиться к паре;</li>
                <li>загружать фотографии;</li>
                <li>создавать совместные моменты;</li>
                <li>получать Match при совпадении фотографий;</li>
                <li>просматривать историю моментов;</li>
                <li>
                  использовать функцию «Звёздное небо», в которой появляются звёзды после
                  Match;
                </li>
                <li>использовать другие функции, доступные в Приложении.</li>
              </ul>
            </section>

            <section className="space-y-3 pt-2">
              <h2 className="font-display text-base font-bold text-[#343033] dark:text-white">
                2. Использование приложения
              </h2>
              <p>
                Для работы OURS используется техническая идентификация пользователя внутри
                системы.
              </p>
              <p>
                Для основных функций Приложения пользователю не требуется регистрация с
                использованием электронной почты, номера телефона или пароля.
              </p>
              <p>
                Пользователь самостоятельно отвечает за действия, совершаемые им в Приложении,
                и за загружаемый им контент.
              </p>
              <p>Пользователь обязуется:</p>
              <ul className="list-disc pl-5 space-y-1.5 marker:text-[#E98787]">
                <li>использовать OURS законным способом;</li>
                <li>не нарушать права других лиц;</li>
                <li>не загружать контент, распространение которого запрещено законодательством;</li>
                <li>
                  не пытаться получить несанкционированный доступ к данным других
                  пользователей или техническим системам OURS;
                </li>
                <li>
                  не использовать Приложение для мошенничества, вредоносных действий или
                  нарушения работы сервиса.
                </li>
              </ul>
            </section>

            <section className="space-y-3 pt-2">
              <h2 className="font-display text-base font-bold text-[#343033] dark:text-white">
                3. Пользовательский контент
              </h2>
              <p>
                Пользователь может загружать в OURS фотографии и другой контент,
                предусмотренный функциональностью Приложения.
              </p>
              <p>
                Пользователь подтверждает, что имеет необходимые права на загружаемый контент и
                имеет право предоставлять его для обработки в рамках работы OURS.
              </p>
              <p>
                Загруженный контент используется для предоставления функций Приложения,
                включая отображение фотографий партнёру, создание моментов, Match, историю и
                «Звёздное небо».
              </p>
              <p>
                Пользователь не должен загружать материалы, которые нарушают права третьих лиц
                или требования применимого законодательства.
              </p>
            </section>

            <section className="space-y-3 pt-2">
              <h2 className="font-display text-base font-bold text-[#343033] dark:text-white">
                4. Пара и совместные моменты
              </h2>
              <p>
                OURS позволяет двум пользователям объединиться в пару.
              </p>
              <p>
                После создания или присоединения к паре пользователи получают возможность
                создавать совместные моменты.
              </p>
              <p>
                Функции и доступ к моментам определяются текущей логикой Приложения.
              </p>
              <p>
                Пользователь понимает, что фотографии, загруженные в рамках пары, могут быть
                доступны другому участнику соответствующей пары в соответствии с
                функциональностью OURS.
              </p>
            </section>

            <section className="space-y-3 pt-2">
              <h2 className="font-display text-base font-bold text-[#343033] dark:text-white">
                5. Бесплатная версия
              </h2>
              <p>
                Основные функции OURS доступны без оплаты.
              </p>
              <p>В бесплатной версии:</p>
              <ul className="list-disc pl-5 space-y-1.5 marker:text-[#E98787]">
                <li>доступны основные функции создания моментов и Match;</li>
                <li>доступно «Звёздное небо»;</li>
                <li>история моментов доступна за последние 7 дней;</li>
                <li>«Звёздное небо» доступно за текущий календарный месяц.</li>
              </ul>
              <p>
                Ограничения бесплатной версии могут изменяться при обновлении Приложения при
                условии соблюдения прав пользователей.
              </p>
            </section>

            <section className="space-y-3 pt-2">
              <h2 className="font-display text-base font-bold text-[#343033] dark:text-white">
                6. OURS Premium
              </h2>
              <p>
                В OURS может быть доступна платная подписка <strong>OURS Premium</strong>.
              </p>
              <p>
                Premium предоставляет дополнительные возможности, связанные с сохранением и
                просмотром истории пары, включая:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 marker:text-[#E98787]">
                <li>доступ к истории моментов старше 7 дней;</li>
                <li>доступ к истории «Звёздного неба» за предыдущие месяцы;</li>
                <li>
                  возможность просматривать «Звёздное небо» за период с момента создания
                  пары в пределах доступных данных.
                </li>
              </ul>
              <p>
                Актуальный состав Premium-функций и стоимость отображаются пользователю в
                Приложении до совершения оплаты.
              </p>
            </section>

            <section className="space-y-3 pt-2">
              <h2 className="font-display text-base font-bold text-[#343033] dark:text-white">
                7. Оплата
              </h2>
              <p>
                Оплата OURS Premium осуществляется через платёжный сервис <strong>ЮKassa</strong> или иной
                платёжный способ, доступный в Приложении.
              </p>
              <p>
                Перед оплатой пользователь видит стоимость и основные условия приобретаемой
                услуги.
              </p>
              <p>
                Premium предоставляется только после подтверждения успешной оплаты платёжным
                сервисом и OURS.
              </p>
              <p>
                Само нажатие кнопки «Оплатить», переход на страницу оплаты или возврат
                пользователя в Приложение не означает успешную оплату.
              </p>
              <p>
                Если платеж не был успешно завершён или не был подтверждён, Premium не
                активируется.
              </p>
            </section>

            <section className="space-y-3 pt-2">
              <h2 className="font-display text-base font-bold text-[#343033] dark:text-white">
                8. Возвраты
              </h2>
              <p>
                Вопросы возврата денежных средств рассматриваются в соответствии с применимым
                законодательством, условиями приобретённой услуги и правилами платёжного
                сервиса.
              </p>
              <p>
                При возникновении вопросов по оплате пользователь может обратиться по
                контактному адресу, указанному в разделе 12 настоящего Соглашения.
              </p>
            </section>

            <section className="space-y-3 pt-2">
              <h2 className="font-display text-base font-bold text-[#343033] dark:text-white">
                9. Изменение Premium
              </h2>
              <p>
                Владелец OURS вправе изменять состав Premium-функций, стоимость и условия их
                предоставления для будущих покупок.
              </p>
              <p>
                Условия уже оплаченного периода не изменяются в одностороннем порядке таким
                образом, чтобы пользователь потерял уже оплаченный доступ, за исключением
                случаев, предусмотренных законодательством или условиями соответствующей
                услуги.
              </p>
            </section>

            <section className="space-y-3 pt-2">
              <h2 className="font-display text-base font-bold text-[#343033] dark:text-white">
                10. Прекращение использования
              </h2>
              <p>
                Пользователь может прекратить использование OURS в любое время.
              </p>
              <p>
                Пользователь также может покинуть созданную пару в соответствии с доступными
                функциями Приложения.
              </p>
              <p>
                Прекращение использования Приложения само по себе не освобождает стороны от
                обязательств, которые по своему характеру должны сохранять силу после
                прекращения использования.
              </p>
            </section>

            <section className="space-y-3 pt-2">
              <h2 className="font-display text-base font-bold text-[#343033] dark:text-white">
                11. Ограничение ответственности
              </h2>
              <p>
                OURS предоставляется в соответствии с его текущими техническими возможностями.
              </p>
              <p>
                Владелец Приложения принимает разумные меры для обеспечения стабильной
                работы сервиса, однако не гарантирует отсутствие технических ошибок, временной
                недоступности или сбоев, связанных с работой сторонних сервисов, сетей и устройств.
              </p>
              <p>
                Владелец OURS не несёт ответственности за содержание фотографий и иного
                контента, загруженного пользователями.
              </p>
            </section>

            <section className="space-y-3 pt-4 border-t border-[#EBE3E5] dark:border-[#242024] rounded-[20px] bg-white/70 dark:bg-[#151315] p-4.5 border border-[#EBE3E5] dark:border-[#242024]">
              <h2 className="font-display text-base font-bold text-[#343033] dark:text-white">
                12. Контактная информация
              </h2>
              <p>
                <strong>Владелец Приложения:</strong> Шмыга Максим Александрович
              </p>
              <p>
                <strong>Электронная почта:</strong>{' '}
                <a
                  href="mailto:maksimshmyga0@gmail.com"
                  className="text-[#E98787] dark:text-[#F0B9C6] underline"
                >
                  maksimshmyga0@gmail.com
                </a>
              </p>
              <p>
                <strong>Дата вступления в силу:</strong> 27.09.2026
              </p>
            </section>

            <p className="text-xs text-[#777277] dark:text-[#B8B2B5] pt-2 italic">
              Используя OURS и приобретая OURS Premium, пользователь подтверждает, что
              ознакомился с настоящим Пользовательским соглашением.
            </p>
          </article>
        ) : (
          /* ================= ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ ================= */
          <article className="space-y-6 pb-12">
            <div className="space-y-2 border-b border-[#EBE3E5] dark:border-[#242024] pb-5">
              <span className="text-[11px] font-bold tracking-wider uppercase text-[#E98787] dark:text-[#F0B9C6] px-2.5 py-1 rounded-full bg-[#FAF0F2] dark:bg-[#251720] border border-[#EED7DC]/70 dark:border-[#382329] inline-block mb-1">
                Юридический документ
              </span>
              <h1 className="font-display text-xl sm:text-2xl font-bold text-[#343033] dark:text-white tracking-tight leading-snug">
                ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ ПРИЛОЖЕНИЯ OURS
              </h1>
              <p className="text-xs text-[#777277] dark:text-[#B8B2B5]">
                Дата вступления в силу: 27.09.2026
              </p>
            </div>

            <p>
              Настоящая Политика конфиденциальности определяет порядок обработки
              информации пользователей мобильного приложения <strong>OURS</strong> (далее — «Приложение»).
            </p>
            <p>
              Используя Приложение, пользователь подтверждает, что ознакомился с настоящей
              Политикой конфиденциальности.
            </p>

            <section className="space-y-3 pt-2">
              <h2 className="font-display text-base font-bold text-[#343033] dark:text-white">
                1. Общие положения
              </h2>
              <p>
                OURS — приложение для пар, позволяющее пользователям создавать совместные
                моменты, обмениваться фотографиями с партнёром, получать Match и сохранять
                историю совместных моментов.
              </p>
              <p>
                Для использования основных функций OURS пользователю не требуется регистрация
                с использованием электронной почты, номера телефона или пароля.
              </p>
              <p>
                Для технической работы Приложения может использоваться анонимная техническая
                сессия пользователя. Такая сессия необходима для идентификации пользователя
                внутри системы OURS и не является регистрацией пользовательского аккаунта в
                традиционном смысле.
              </p>
            </section>

            <section className="space-y-3 pt-2">
              <h2 className="font-display text-base font-bold text-[#343033] dark:text-white">
                2. Какую информацию обрабатывает OURS
              </h2>
              <p>
                В зависимости от используемых пользователем функций OURS может обрабатывать
                следующие данные:
              </p>

              <div className="space-y-2 pl-1 pt-1">
                <h3 className="font-display text-sm font-bold text-[#343033] dark:text-white">
                  2.1. Фотографии
                </h3>
                <p>
                  Пользователь может добровольно загружать фотографии в Приложение.
                </p>
                <p>Фотографии используются для:</p>
                <ul className="list-disc pl-5 space-y-1.5 marker:text-[#E98787]">
                  <li>отображения пользователю и его партнёру;</li>
                  <li>создания совместных моментов;</li>
                  <li>работы функции Match;</li>
                  <li>формирования истории моментов;</li>
                  <li>работы связанных функций Приложения.</li>
                </ul>
                <p>
                  Загруженные фотографии могут храниться в инфраструктуре облачного сервиса,
                  используемого OURS для хранения данных.
                </p>
              </div>

              <div className="space-y-2 pl-1 pt-2">
                <h3 className="font-display text-sm font-bold text-[#343033] dark:text-white">
                  2.2. Данные о совместных моментах
                </h3>
                <p>
                  OURS может хранить информацию, связанную с созданными моментами, включая:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 marker:text-[#E98787]">
                  <li>дату и время момента;</li>
                  <li>фотографии, связанные с моментом;</li>
                  <li>идентификатор пары;</li>
                  <li>информацию о состоянии Match;</li>
                  <li>иные технические данные, необходимые для работы соответствующей функции.</li>
                </ul>
              </div>

              <div className="space-y-2 pl-1 pt-2">
                <h3 className="font-display text-sm font-bold text-[#343033] dark:text-white">
                  2.3. Данные о паре
                </h3>
                <p>
                  Для работы функций создания и подключения к паре могут обрабатываться:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 marker:text-[#E98787]">
                  <li>идентификатор пары;</li>
                  <li>технический идентификатор пользователя;</li>
                  <li>
                    имя, указанное пользователем для отображения в рамках пары, если такая
                    функция используется.
                  </li>
                </ul>
              </div>

              <div className="space-y-2 pl-1 pt-2">
                <h3 className="font-display text-sm font-bold text-[#343033] dark:text-white">
                  2.4. Техническая информация
                </h3>
                <p>
                  Для обеспечения работы Приложения могут автоматически обрабатываться
                  технические данные, необходимые для его функционирования, диагностики ошибок и
                  обеспечения безопасности.
                </p>
                <p>
                  Объём такой информации зависит от операционной системы, устройства и
                  используемых функций.
                </p>
              </div>
            </section>

            <section className="space-y-3 pt-2">
              <h2 className="font-display text-base font-bold text-[#343033] dark:text-white">
                3. Для чего используются данные
              </h2>
              <p>
                Информация пользователя используется в целях, связанных с работой OURS,
                включая:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 marker:text-[#E98787]">
                <li>предоставление функций Приложения;</li>
                <li>создание и отображение совместных моментов;</li>
                <li>работу Match;</li>
                <li>хранение и отображение истории;</li>
                <li>работу функции «Звёздное небо»;</li>
                <li>предоставление Premium-функций;</li>
                <li>обработку платежей;</li>
                <li>обеспечение безопасности и стабильности Приложения;</li>
                <li>устранение технических ошибок;</li>
                <li>улучшение работы Приложения.</li>
              </ul>
            </section>

            <section className="space-y-3 pt-2">
              <h2 className="font-display text-base font-bold text-[#343033] dark:text-white">
                4. Фотографии и доступ к ним
              </h2>
              <p>
                Фотографии являются пользовательским контентом.
              </p>
              <p>
                Пользователь самостоятельно решает, какую фотографию загрузить в OURS.
              </p>
              <p>
                Фотографии могут передаваться и храниться на серверах и в облачной
                инфраструктуре, необходимой для работы Приложения.
              </p>
              <p>
                Доступ к фотографиям предоставляется в соответствии с логикой OURS и
                настройками конкретной пары.
              </p>
              <p>
                OURS не продаёт пользовательские фотографии третьим лицам.
              </p>
            </section>

            <section className="space-y-3 pt-2">
              <h2 className="font-display text-base font-bold text-[#343033] dark:text-white">
                5. Платежи и Premium
              </h2>
              <p>
                Для приобретения подписки OURS Premium может использоваться платёжный сервис <strong>ЮKassa</strong>.
              </p>
              <p>
                При осуществлении платежа необходимые для его обработки платёжные данные могут
                передаваться непосредственно платёжному сервису в соответствии с его
                собственными правилами и политикой обработки данных.
              </p>
              <p>
                OURS не хранит данные банковских карт пользователей.
              </p>
              <p>
                Информация о результате платежа может обрабатываться OURS для предоставления
                оплаченной Premium-функциональности.
              </p>
            </section>

            <section className="space-y-3 pt-2">
              <h2 className="font-display text-base font-bold text-[#343033] dark:text-white">
                6. Передача данных третьим лицам
              </h2>
              <p>
                OURS может использовать сторонние сервисы и технических поставщиков,
                необходимые для работы Приложения, включая:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 marker:text-[#E98787]">
                <li>облачную инфраструктуру и базы данных;</li>
                <li>сервисы хранения фотографий;</li>
                <li>платёжные сервисы;</li>
                <li>инфраструктуру, необходимую для технической работы Приложения.</li>
              </ul>
              <p>
                Передача данных осуществляется только в объёме, необходимом для
                соответствующей цели.
              </p>
              <p>
                OURS не продаёт персональные данные пользователей третьим лицам.
              </p>
            </section>

            <section className="space-y-3 pt-2">
              <h2 className="font-display text-base font-bold text-[#343033] dark:text-white">
                7. Хранение данных
              </h2>
              <p>
                Данные хранятся в течение периода, необходимого для предоставления
                соответствующих функций OURS, выполнения обязательств перед пользователем и
                соблюдения применимых требований законодательства.
              </p>
              <p>
                Срок хранения конкретных данных может зависеть от типа информации и
                используемой функции.
              </p>
            </section>

            <section className="space-y-3 pt-2">
              <h2 className="font-display text-base font-bold text-[#343033] dark:text-white">
                8. Удаление данных
              </h2>
              <p>
                Пользователь может прекратить использование OURS и покинуть созданную пару.
              </p>
              <p>
                Если пользователь хочет запросить удаление относящихся к нему данных, он может
                обратиться по контактному адресу, указанному в настоящей Политике.
              </p>
              <p>
                Запрос должен позволять определить пользователя или соответствующую пару, чтобы
                OURS мог корректно обработать запрос.
              </p>
              <p>
                При этом отдельные данные могут сохраняться в случаях, когда их хранение
                необходимо для выполнения требований законодательства, предотвращения
                злоупотреблений, разрешения споров или защиты законных интересов.
              </p>
            </section>

            <section className="space-y-3 pt-2">
              <h2 className="font-display text-base font-bold text-[#343033] dark:text-white">
                9. Безопасность
              </h2>
              <p>
                OURS принимает разумные технические и организационные меры для защиты
                обрабатываемой информации от несанкционированного доступа, изменения,
                раскрытия или уничтожения.
              </p>
              <p>
                При этом ни один способ передачи или хранения данных в интернете не может
                гарантировать абсолютную безопасность.
              </p>
            </section>

            <section className="space-y-3 pt-2">
              <h2 className="font-display text-base font-bold text-[#343033] dark:text-white">
                10. Дети
              </h2>
              <p>
                OURS не предназначен для использования лицами, которые не достигли возраста,
                позволяющего самостоятельно принимать условия использования Приложения в
                соответствии с применимым законодательством.
              </p>
              <p>
                Если нам станет известно, что данные были предоставлены лицом, не имеющим права
                самостоятельно использовать Приложение, мы примем разумные меры для их
                удаления в предусмотренных случаях.
              </p>
            </section>

            <section className="space-y-3 pt-2">
              <h2 className="font-display text-base font-bold text-[#343033] dark:text-white">
                11. Изменение Политики конфиденциальности
              </h2>
              <p>
                Мы можем периодически обновлять настоящую Политику конфиденциальности.
              </p>
              <p>
                Актуальная версия Политики публикуется внутри Приложения или иным доступным
                пользователям способом.
              </p>
              <p>
                Продолжение использования OURS после внесения изменений означает
                ознакомление пользователя с обновлённой версией Политики.
              </p>
            </section>

            <section className="space-y-3 pt-4 border-t border-[#EBE3E5] dark:border-[#242024] rounded-[20px] bg-white/70 dark:bg-[#151315] p-4.5 border border-[#EBE3E5] dark:border-[#242024]">
              <h2 className="font-display text-base font-bold text-[#343033] dark:text-white">
                12. Контактная информация
              </h2>
              <p>
                <strong>Владелец Приложения:</strong> Шмыга Максим Александрович
              </p>
              <p>
                <strong>Электронная почта:</strong>{' '}
                <a
                  href="mailto:maksimshmyga0@gmail.com"
                  className="text-[#E98787] dark:text-[#F0B9C6] underline"
                >
                  maksimshmyga0@gmail.com
                </a>
              </p>
              <p>
                <strong>Дата вступления в силу:</strong> 27.09.2026
              </p>
            </section>

            <div className="pt-4 text-center border-t border-[#EBE3E5] dark:border-[#242024]">
              <p className="text-xs text-[#777277] dark:text-[#B8B2B5]">
                Приложение OURS
              </p>
              <p className="text-xs text-[#A89CA1] dark:text-[#6E676C]">
                © 2026 OURS. Все права защищены.
              </p>
            </div>
          </article>
        )}
      </main>
    </div>
  );
};
