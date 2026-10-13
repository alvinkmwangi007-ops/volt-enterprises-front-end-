import { useEffect, useMemo, useState } from 'react'
import AnimatedDropdown from './components/AnimatedDropdown'
import { apiDownload, apiRequest, apiUrl, clearAuthSession, getAccessToken, saveAuthSession } from './api'
import './App.css'

const OTHER_OPTION = '__other__'
const PLACEHOLDER_VEHICLE_IMAGE = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 640 400%22%3E%3Crect width=%22640%22 height=%22400%22 fill=%22%23eef2f8%22/%3E%3Cpath d=%22M140 245h360l-30-88a35 35 0 0 0-33-24H232a35 35 0 0 0-33 24z%22 fill=%22%23cbd5e1%22/%3E%3Ccircle cx=%22225%22 cy=%22255%22 r=%2232%22 fill=%22%2364748b%22/%3E%3Ccircle cx=%22415%22 cy=%22255%22 r=%2232%22 fill=%22%2364748b%22/%3E%3C/svg%3E'
const vehicleModelsByMake = {
  Toyota: ['Vitz', 'Probox', 'Corolla Fielder', 'Corolla Axio', 'Premio', 'Allion', 'RAV4', 'Land Cruiser Prado', 'Land Cruiser V8', 'HiAce', 'Hilux'],
  Mazda: ['Demio', 'CX-5', 'Axela'],
  Honda: ['Fit', 'Vezel'],
  Nissan: ['Note', 'X-Trail', 'March'],
  Subaru: ['Forester', 'Impreza'],
  Isuzu: ['D-Max'],
  Suzuki: ['Alto'],
}
const vehicleMakes = Object.keys(vehicleModelsByMake)

function generateCsv(rows) {
  const header = ['Week', 'Income', 'Expenses', 'Net']
  const lines = [header.join(',')]

  rows.forEach((row) => {
    lines.push([row.week, row.income, row.expenses, row.income - row.expenses].join(','))
  })

  return lines.join('\n')
}

function mapCar(car) {
  const sortedImages = (car.images || [])
    .sort((left, right) => Number(right.is_primary) - Number(left.is_primary))
  const photos = sortedImages.map((image) => image.image_url)
  return {
    id: String(car.id),
    make: car.make,
    model: car.model,
    name: `${car.make} ${car.model}`,
    type: car.vehicle_type || 'Vehicle',
    mileage: Number(car.mileage) || 0,
    year: Number(car.year),
    price: Number(car.price) || 0,
    transmission: car.transmission,
    plate: car.plate || '',
    showroom: car.showroom || '',
    location: car.location || '',
    contactName: car.seller_name || 'Seller',
    contact: car.seller_phone || '',
    verified: car.verification_status === 'verified',
    onlineSale: Boolean(car.online_sale),
    photos,
    photoIds: sortedImages.map((image) => image.id),
  }
}

function App() {
  const [userRole, setUserRole] = useState('guest')
  const [currentUser, setCurrentUser] = useState(null)
  const [activeView, setActiveView] = useState('Inventory')
  const [authLoading, setAuthLoading] = useState(true)
  const [inventoryStatus, setInventoryStatus] = useState('')
  const [customers, setCustomers] = useState([])
  const [salesData, setSalesData] = useState([])
  const [privateDocuments, setPrivateDocuments] = useState([])
  const [documentStatus, setDocumentStatus] = useState('')
  const [interestedVehicleIds, setInterestedVehicleIds] = useState(() => {
    const savedCart = sessionStorage.getItem('volt-enterprise-buyer-cart')
    if (!savedCart) return []

    try {
      const parsedCart = JSON.parse(savedCart)
      return Array.isArray(parsedCart) ? parsedCart.filter((id) => typeof id === 'string') : []
    } catch {
      return []
    }
  })
  const [chartType, setChartType] = useState('bars')
  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [chatVehicle, setChatVehicle] = useState(null)
  const [chatInquiryId, setChatInquiryId] = useState(null)
  const [chatMessages, setChatMessages] = useState([])
  const [chatStatus, setChatStatus] = useState('')
  const [chatDraft, setChatDraft] = useState('')
  const [phoneCopyStatus, setPhoneCopyStatus] = useState('')
  const [sellerAuthMode, setSellerAuthMode] = useState('login')
  const [sellerAuthStatus, setSellerAuthStatus] = useState('')
  const [buyerAuthMode, setBuyerAuthMode] = useState('login')
  const [buyerAuthStatus, setBuyerAuthStatus] = useState('')
  const [managerAuthStatus, setManagerAuthStatus] = useState('')
  const [managerCreationStatus, setManagerCreationStatus] = useState('')
  const [listingMakeChoice, setListingMakeChoice] = useState('')
  const [listingCustomMake, setListingCustomMake] = useState('')
  const [listingModelChoice, setListingModelChoice] = useState('')
  const [listingCustomModel, setListingCustomModel] = useState('')
  const [sellerOnlineSaleChoice, setSellerOnlineSaleChoice] = useState(null)
  const [sellerImportedVehicleChoice, setSellerImportedVehicleChoice] = useState(null)
  const [vehicleListings, setVehicleListings] = useState([])
  const [sellerProfile, setSellerProfile] = useState({
    fullName: '',
    email: '',
    phone: '',
    nationalId: '',
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: '',
    mileage: '',
    plate: '',
    sellerLocation: '',
    transmission: 'automatic',
    onlineSale: false,
    financeStatus: '',
    importedVehicle: null,
    eCitizenPhone: '',
    legalDocuments: {
      ownership: '',
      sellerId: '',
      importDuty: '',
    },
    interestNotifications: '',
    photos: ['', '', ''],
    photoIds: [],
  })
  const [sellerDraft, setSellerDraft] = useState(sellerProfile)
  const [sellerPhotoUploads, setSellerPhotoUploads] = useState([null, null, null])
  const [isEditingSettings, setIsEditingSettings] = useState(false)
  const [settingsStatus, setSettingsStatus] = useState('')
  const settingsMakeChoice = vehicleMakes.includes(sellerDraft.vehicleMake) ? sellerDraft.vehicleMake : OTHER_OPTION
  const settingsModelOptions = vehicleModelsByMake[sellerDraft.vehicleMake] || []
  const settingsModelChoice = settingsModelOptions.includes(sellerDraft.vehicleModel) ? sellerDraft.vehicleModel : OTHER_OPTION
  const listingModelOptions = vehicleModelsByMake[listingMakeChoice] || []

  useEffect(() => {
    sessionStorage.removeItem('volt-enterprise-role')
    sessionStorage.removeItem('volt-enterprise-vehicle-chats')
  }, [])

  useEffect(() => {
    sessionStorage.setItem('volt-enterprise-buyer-cart', JSON.stringify(interestedVehicleIds))
  }, [interestedVehicleIds])

  useEffect(() => {
    let isMounted = true
    const loadSessionAndInventory = async () => {
      const savedToken = getAccessToken()
      const inventoryRequest = apiRequest('/cars')
        .then((cars) => {
          if (!isMounted) return
          const listings = cars.map(mapCar)
          setVehicleListings(listings)
          setInterestedVehicleIds((ids) => ids.filter((id) => listings.some((car) => car.id === id)))
          setInventoryStatus('')
        })
        .catch((error) => {
          if (isMounted) setInventoryStatus(error.message)
        })
      if (!savedToken) {
        setAuthLoading(false)
        await inventoryRequest
        return
      }
      await inventoryRequest
      try {
        const user = await apiRequest('/users/me')
        if (!isMounted) return
        setCurrentUser(user)
        setUserRole(user.role)
        setSellerProfile((profile) => ({
          ...profile,
          fullName: user.full_name || '',
          email: user.email || '',
          phone: user.phone_number || '',
          nationalId: user.national_id || '',
          interestNotifications: user.interest_notifications,
        }))
        if (user.role === 'seller') {
          const ownCars = await apiRequest('/cars/mine')
          if (!isMounted) return
          const ownListings = ownCars.map(mapCar)
          setVehicleListings((listings) => [
            ...listings.filter((car) => !ownListings.some((ownCar) => ownCar.id === car.id)),
            ...ownListings,
          ])
          const latestListing = ownCars[0]
          if (latestListing) {
            setSellerProfile((profile) => ({
              ...profile,
              vehicleMake: latestListing.make,
              vehicleModel: latestListing.model,
              vehicleYear: String(latestListing.year),
              mileage: String(latestListing.mileage),
              plate: latestListing.plate || '',
              sellerLocation: latestListing.location || '',
              transmission: latestListing.transmission || 'automatic',
              onlineSale: Boolean(latestListing.online_sale),
              financeStatus: latestListing.finance_status || '',
              importedVehicle: latestListing.imported_vehicle,
              photos: mapCar(latestListing).photos,
              photoIds: mapCar(latestListing).photoIds,
            }))
          }
        }
        setActiveView(user.role === 'admin' ? 'Dashboard' : 'Inventory')
      } catch {
        clearAuthSession()
        if (isMounted) {
          setCurrentUser(null)
          setUserRole('guest')
          setActiveView('Inventory')
        }
      } finally {
        if (isMounted) setAuthLoading(false)
      }
      await inventoryRequest
    }
    loadSessionAndInventory()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (userRole !== 'admin') return
    let isMounted = true
    Promise.all([apiRequest('/users'), apiRequest('/deals')])
      .then(([users, deals]) => {
        if (!isMounted) return
        setCustomers(users.filter((user) => user.role === 'buyer'))
        setSalesData(deals
          .filter((deal) => deal.status === 'completed')
          .slice()
          .sort((left, right) => new Date(left.created_at) - new Date(right.created_at))
          .slice(-5)
          .map((deal, index) => ({
            week: new Date(deal.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
            income: Number(deal.agreed_price) || 0,
            expenses: 0,
            key: deal.id || index,
          })))
      })
      .catch((error) => setInventoryStatus(error.message))
    return () => {
      isMounted = false
    }
  }, [userRole])

  useEffect(() => {
    if (userRole !== 'admin') {
      return
    }
    let isMounted = true
    apiRequest('/admin/documents')
      .then((documents) => {
        if (isMounted) {
          setPrivateDocuments(documents)
          setDocumentStatus('')
        }
      })
      .catch((error) => {
        if (isMounted) setDocumentStatus(error.message)
      })
    return () => {
      isMounted = false
    }
  }, [userRole])

  useEffect(() => {
    if (!selectedVehicle && !chatVehicle) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (chatVehicle) setChatVehicle(null)
        else setSelectedVehicle(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedVehicle, chatVehicle])

  const navItems = useMemo(() => [
    ...(userRole === 'admin' ? [{ label: 'Dashboard', view: 'Dashboard' }] : []),
    { label: 'Inventory', view: 'Inventory' },
    ...(userRole === 'admin' ? [{ label: 'Customers', view: 'Customers' }] : []),
    ...(userRole === 'admin' ? [{ label: 'Documents', view: 'Documents' }] : []),
    ...(userRole === 'buyer' ? [{ label: 'Cart', view: 'Cart' }] : []),
    ...(userRole === 'guest' ? [
      { label: 'Buyer Login', view: 'Buyer Login' },
      { label: 'Seller Login', view: 'Seller Login' },
      { label: 'Manager Login', view: 'Manager Login' },
    ] : []),
    ...(userRole !== 'guest' ? [{ label: 'Settings', view: 'Settings' }] : []),
  ], [userRole])

  const maxValue = Math.max(1, ...salesData.flatMap(({ income, expenses }) => [income, expenses]))

  const establishSession = (authResponse) => {
    saveAuthSession(authResponse)
    setCurrentUser(authResponse.user)
    setUserRole(authResponse.user.role)
    setActiveView(authResponse.user.role === 'admin'
      ? 'Dashboard'
      : 'Inventory')
  }

  const logout = () => {
    clearAuthSession()
    setCurrentUser(null)
    setUserRole('guest')
    setSelectedVehicle(null)
    setActiveView('Inventory')
    setInterestedVehicleIds([])
    sessionStorage.removeItem('volt-enterprise-buyer-cart')
    sessionStorage.removeItem('volt-enterprise-role')
    setChatMessages([])
    setChatInquiryId(null)
  }

  const logoutSeller = () => {
    logout()
    setSellerAuthMode('login')
    setSellerAuthStatus('You have been logged out.')
  }

  const logoutBuyer = () => {
    logout()
    setBuyerAuthMode('login')
    setBuyerAuthStatus('')
  }

  const openVehicleProfile = (vehicle) => {
    setSelectedVehicle(vehicle)
    setPhoneCopyStatus('')
  }

  const toggleInterestedVehicle = (vehicleId) => {
    setInterestedVehicleIds((currentIds) => currentIds.includes(vehicleId)
      ? currentIds.filter((id) => id !== vehicleId)
      : [...currentIds, vehicleId])
  }

  const openVehicleChat = async (vehicle) => {
    setChatVehicle(vehicle)
    setChatDraft('')
    setChatMessages([])
    setChatInquiryId(null)
    setChatStatus('')
    if (!['buyer', 'seller'].includes(userRole) || !currentUser) {
      setChatStatus('Sign in as a buyer or seller to use vehicle chat.')
      return
    }
    try {
      const inquiries = await apiRequest(`/inquiries/user/${currentUser.id}`)
      let inquiry = inquiries.find((item) => String(item.car_id) === vehicle.id)
      if (!inquiry && userRole === 'buyer') {
        inquiry = await apiRequest('/inquiries', {
          method: 'POST',
          body: JSON.stringify({ car_id: Number(vehicle.id) }),
        })
      }
      if (!inquiry) {
        setChatStatus('The buyer must start a conversation before you can reply.')
        return
      }
      setChatInquiryId(inquiry.id)
      const fullInquiry = await apiRequest(`/inquiries/${inquiry.id}`)
      setChatMessages((fullInquiry.messages || []).map((message) => ({
        ...message,
        sender: String(message.sender_id) === String(currentUser.id)
          ? (userRole === 'buyer' ? 'Buyer' : 'Seller')
          : (userRole === 'buyer' ? 'Seller' : 'Buyer'),
        message: message.body,
        sentAt: message.sent_at,
      })))
    } catch (error) {
      setChatStatus(error.message)
    }
  }

  const sendVehicleChatMessage = async (event) => {
    event.preventDefault()
    const message = chatDraft.trim()
    if (!chatInquiryId || !message || !['buyer', 'seller'].includes(userRole)) return
    try {
      const savedMessage = await apiRequest(`/inquiries/${chatInquiryId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: message }),
      })
      setChatMessages((messages) => [...messages, {
        ...savedMessage,
        sender: userRole === 'buyer' ? 'Buyer' : 'Seller',
        message: savedMessage.body,
        sentAt: savedMessage.sent_at,
      }])
      setChatDraft('')
      setChatStatus('')
    } catch (error) {
      setChatStatus(error.message)
    }
  }

  const copyPhoneNumber = (event, phoneNumber) => {
    event.stopPropagation()
    if (!navigator.clipboard?.writeText) {
      setPhoneCopyStatus('Clipboard access is unavailable in this browser.')
      return
    }

    navigator.clipboard.writeText(phoneNumber)
      .then(() => setPhoneCopyStatus('Phone number copied.'))
      .catch(() => setPhoneCopyStatus('Could not copy the phone number; you can still call using the dialer.'))
  }

  const updateLegalDocument = (documentKey, file, setDraft, input) => {
    if (!file) return
    const acceptedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    const acceptedExtensions = /\.(pdf|jpe?g|png|webp)$/i
    if (!acceptedTypes.includes(file.type) && !acceptedExtensions.test(file.name)) {
      input.value = ''
      setDraft((current) => ({
        ...current,
        legalDocumentError: 'Choose a PDF, JPG, PNG, or WebP document.',
      }))
      return
    }

    setDraft((current) => ({
      ...current,
      legalDocumentError: '',
      legalDocuments: {
        ...current.legalDocuments,
        [documentKey]: file.name,
      },
    }))
  }

  const updateSellerProfile = async (event) => {
    event.preventDefault()
    if (!sellerDraft.nationalId.trim()) {
      setSettingsStatus('National ID number is required.')
      return
    }
    const listing = vehicleListings.find((vehicle) => vehicle.contactName === currentUser?.full_name)
    if (!listing) {
      setSettingsStatus('Create a vehicle listing before editing its details.')
      return
    }
    try {
      const [updatedUser, updatedCar] = await Promise.all([
        apiRequest('/users/me', {
          method: 'PATCH',
          body: JSON.stringify({
            full_name: sellerDraft.fullName,
            national_id: sellerDraft.nationalId,
            interest_notifications: Boolean(sellerDraft.interestNotifications),
          }),
        }),
        apiRequest(`/cars/${listing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            make: sellerDraft.vehicleMake,
            model: sellerDraft.vehicleModel,
            year: Number(sellerDraft.vehicleYear),
            mileage: Number(sellerDraft.mileage),
            transmission: sellerDraft.transmission,
            location: sellerDraft.sellerLocation,
            showroom: sellerDraft.showroom || null,
            online_sale: Boolean(sellerDraft.onlineSale),
            finance_status: sellerDraft.financeStatus || null,
            imported_vehicle: sellerDraft.importedVehicle,
          }),
        }),
      ])
      const photoUploads = sellerPhotoUploads
        .map((file, index) => ({ file, index }))
        .filter(({ file }) => file)
      let savedCar = updatedCar
      if (photoUploads.length) {
        const photoForm = new FormData()
        const fields = ['vehicle_photo_front', 'vehicle_photo_side', 'vehicle_photo_rear']
        photoUploads.forEach(({ file, index }) => photoForm.append(fields[index], file))
        await apiRequest(`/cars/${listing.id}/photos`, { method: 'POST', body: photoForm })
        savedCar = await apiRequest(`/cars/${listing.id}`)
      }
      const updatedProfile = {
        ...sellerDraft,
        fullName: updatedUser.full_name,
        nationalId: updatedUser.national_id || '',
        interestNotifications: updatedUser.interest_notifications,
        photos: mapCar(savedCar).photos,
        photoIds: mapCar(savedCar).photoIds,
      }
      setCurrentUser(updatedUser)
      setSellerProfile(updatedProfile)
      setSellerDraft(updatedProfile)
      setSellerPhotoUploads([null, null, null])
      setVehicleListings((listings) => listings.map((vehicle) => (
        vehicle.id === String(savedCar.id) ? mapCar({ ...savedCar, seller_name: updatedUser.full_name, seller_phone: updatedUser.phone_number }) : vehicle
      )))
      setIsEditingSettings(false)
      setSettingsStatus('Profile and vehicle changes saved.')
    } catch (error) {
      setSettingsStatus(error.message)
    }
  }

  const updateProfilePhoto = (index, file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setSettingsStatus('Choose an image file for the vehicle photo.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setSettingsStatus('Could not read that image. Please choose another file.')
        return
      }
      setSellerDraft((profile) => {
        const photos = [...profile.photos]
        photos[index] = reader.result
        return { ...profile, photos }
      })
      setSellerPhotoUploads((uploads) => uploads.map((upload, position) => (
        position === index ? file : upload
      )))
      setSettingsStatus(`Photo ${index + 1} selected. Save changes to apply it.`)
    }
    reader.onerror = () => setSettingsStatus('Could not read that image. Please choose another file.')
    reader.readAsDataURL(file)
  }

  const exportExcel = () => {
    const csv = generateCsv(salesData)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'sales-report.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const exportPdf = () => {
    window.print()
  }

  const renderDashboard = () => (
    <section className="content dashboard-entry">
      <div className="cashflow-header">
        <h1>Cashflow Overview</h1>

        <div className="chart-toggle-wrap">
          <div className="legend">
            <span className="legend-item income"><i />Income</span>
            <span className="legend-item expenses"><i />Expenses</span>
          </div>

          <div className="toggle-buttons">
            <button
              type="button"
              className={chartType === 'bars' ? 'active' : ''}
              onClick={() => setChartType('bars')}
            >
              Bars
            </button>
            <button
              type="button"
              className={chartType === 'lines' ? 'active' : ''}
              onClick={() => setChartType('lines')}
            >
              Lines
            </button>
          </div>
        </div>
      </div>

      <div className="export-actions">
        <button type="button" onClick={exportExcel}>Export Excel</button>
        <button type="button" onClick={exportPdf}>Export PDF</button>
      </div>

      <div className="cashflow-card">
        {salesData.length === 0 && <p className="seller-privacy-note">No completed sales data is available yet.</p>}
        {salesData.length > 0 && <p className="seller-privacy-note">Operating expenses are not tracked by the backend yet.</p>}
        <div className="chart-area">
          {[3000, 2000, 1000, 0].map((label) => (
            <div key={label} className="grid-row" style={{ '--label-value': `${label}` }}>
              <span>KES {Math.round((maxValue * label) / 3000).toLocaleString()}</span>
            </div>
          ))}

          <svg viewBox="0 0 1000 420" className="chart-svg" role="img" aria-label="Sales chart">
            {chartType === 'bars' ? (
              salesData.map((item, index) => {
                const x = 120 + index * 180
                const incomeHeight = (item.income / maxValue) * 300
                const expenseHeight = (item.expenses / maxValue) * 300
                const incomeY = 320 - incomeHeight
                const expenseY = 320 - expenseHeight
                const isActive = index === salesData.length - 1

                return (
                  <g key={item.week}>
                    <rect
                      x={x - 42}
                      y={incomeY}
                      width={52}
                      height={incomeHeight}
                      rx={26}
                      fill="#3d5ef5"
                      className={isActive ? 'active-bar' : ''}
                    />
                    <rect
                      x={x + 12}
                      y={expenseY}
                      width={52}
                      height={expenseHeight}
                      rx={26}
                      fill="#dfe7ff"
                    />
                    <text x={x} y={390} textAnchor="middle" fill="#2d3748" fontSize="26">{item.week}</text>
                  </g>
                )
              })
            ) : (
              <>
                <path
                  d={salesData
                    .map((item, index) => {
                      const x = 120 + index * 180
                      const y = 320 - (item.income / maxValue) * 300
                      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
                    })
                    .join(' ')}
                  fill="none"
                  stroke="#3d5ef5"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="line-path"
                />
                {salesData.map((item, index) => {
                  const x = 120 + index * 180
                  const y = 320 - (item.income / maxValue) * 300
                  return <circle key={item.week} cx={x} cy={y} r="6" fill="#3d5ef5" />
                })}
                {salesData.map((item, index) => {
                  const x = 120 + index * 180
                  const y = 320 - (item.expenses / maxValue) * 300
                  return <circle key={`${item.week}-expense`} cx={x} cy={y} r="6" fill="#dfe7ff" />
                })}
              </>
            )}
          </svg>

        </div>
      </div>
    </section>
  )

  const renderCustomers = () => (
    <section className="content">
      <h1>Customers</h1>
      {inventoryStatus && <p className="seller-form-status" role="alert">{inventoryStatus}</p>}
      <div className="customer-list-wrap">
        <table className="customer-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>City</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td>{customer.full_name}</td>
                <td>{customer.email}</td>
                <td>{customer.phone_number}</td>
                <td>—</td>
              </tr>
            ))}
            {customers.length === 0 && <tr><td colSpan="4">No registered buyers yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {userRole === 'admin' && (
        <form
          className="seller-form manager-create-form"
          onSubmit={async (event) => {
            event.preventDefault()
            const values = new FormData(event.currentTarget)
            try {
              await apiRequest('/users/managers', {
                method: 'POST',
                body: JSON.stringify({
                  full_name: values.get('managerName'),
                  email: values.get('managerEmail'),
                  phone_number: values.get('managerPhone'),
                  password: values.get('managerPassword'),
                }),
              })
              event.currentTarget.reset()
              setManagerCreationStatus('Manager account created.')
            } catch (error) {
              setManagerCreationStatus(error.message)
            }
          }}
        >
          <h2>Create manager account</h2>
          <label className="seller-field">
            <span>Full name</span>
            <input type="text" name="managerName" required />
          </label>
          <label className="seller-field">
            <span>Email</span>
            <input type="email" name="managerEmail" required />
          </label>
          <label className="seller-field">
            <span>Phone number</span>
            <input type="tel" name="managerPhone" required />
          </label>
          <label className="seller-field">
            <span>Temporary password (at least 12 characters)</span>
            <input type="password" name="managerPassword" minLength={12} autoComplete="new-password" required />
          </label>
          <button className="seller-primary-button" type="submit">Create manager</button>
          <p className="seller-form-status" role="status" aria-live="polite">{managerCreationStatus}</p>
        </form>
      )}
    </section>
  )

  const renderAdminDocuments = () => (
    <section className="content">
      <h1>Seller documents</h1>
      <p>Private vehicle ownership and seller identity files are restricted to administrators.</p>
      {documentStatus && <p className="seller-form-status" role="alert">{documentStatus}</p>}
      {privateDocuments.length === 0 && !documentStatus && (
        <p className="seller-privacy-note">No seller documents have been uploaded.</p>
      )}
      <div className="customer-list-wrap">
        <table className="customer-table">
          <thead>
            <tr><th>Vehicle</th><th>Seller</th><th>Document</th><th>Uploaded</th><th>Access</th></tr>
          </thead>
          <tbody>
            {privateDocuments.map((privateFile) => (
              <tr key={privateFile.id}>
                <td>{privateFile.vehicle}</td>
                <td>{privateFile.seller_name}<br />{privateFile.seller_email}</td>
                <td>{privateFile.label} · {privateFile.original_name}</td>
                <td>{privateFile.created_at ? new Date(privateFile.created_at).toLocaleDateString() : '—'}</td>
                <td>
                  <button
                    className="seller-secondary-button"
                    type="button"
                    onClick={async () => {
                      try {
                        const blob = await apiDownload(privateFile.file_url)
                        const url = URL.createObjectURL(blob)
                        const anchor = document.createElement('a')
                        anchor.href = url
                        anchor.download = privateFile.original_name
                        anchor.click()
                        URL.revokeObjectURL(url)
                      } catch (error) {
                        setDocumentStatus(error.message)
                      }
                    }}
                  >
                    View / download
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )

  const renderSellerAccess = () => (
    <section className="content seller-access-content">
      <div className="seller-access-heading">
        <p className="seller-eyebrow">Seller portal</p>
        <h1>Sell with Volt Motors</h1>
        <p>Sign in with your verified phone number or create an account and prepare your vehicle listing.</p>
      </div>

      <div className="seller-access-card">
        <div className="seller-auth-tabs" role="tablist" aria-label="Seller account options">
          <button
            type="button"
            role="tab"
            aria-selected={sellerAuthMode === 'login'}
            className={sellerAuthMode === 'login' ? 'active' : ''}
            onClick={() => {
              setSellerAuthMode('login')
              setSellerAuthStatus('')
            }}
          >
            Seller login
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={sellerAuthMode === 'signup'}
            className={sellerAuthMode === 'signup' ? 'active' : ''}
            onClick={() => {
              setSellerAuthMode('signup')
              setSellerAuthStatus('')
            }}
          >
            Create seller account
          </button>
        </div>

        {sellerAuthMode === 'login' ? (
          <form
            className="seller-form"
            onSubmit={async (event) => {
              event.preventDefault()
              const formData = new FormData(event.currentTarget)
              const phone = String(formData.get('loginPhone') || '').trim()
              const otp = String(formData.get('loginOtp') || '')
              try {
                const authResponse = await apiRequest('/auth/otp/verify', {
                  method: 'POST',
                  body: JSON.stringify({ phone_number: phone, otp }),
                })
                if (authResponse.user.role !== 'seller') {
                  setSellerAuthStatus('This verified phone number is not registered as a seller account.')
                  return
                }
                establishSession(authResponse)
                setSellerAuthStatus('')
              } catch (error) {
                setSellerAuthStatus(error.message)
              }
            }}
          >
            <div className="seller-form-heading">
              <h2>Welcome back</h2>
              <p>Use the mobile number registered to your seller account.</p>
            </div>
            <label className="seller-field">
              <span>Mobile phone number</span>
              <input
                type="tel"
                name="loginPhone"
                autoComplete="tel"
                placeholder="+254 7XX XXX XXX"
                required
              />
            </label>
            <div className="seller-otp-field">
              <label className="seller-field">
                <span>One-time password (OTP)</span>
                <input
                  type="text"
                  name="loginOtp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="6-digit code"
                  required
                />
              </label>
              <button
                className="seller-secondary-button"
                type="button"
                onClick={async (event) => {
                  const phone = event.currentTarget.form.elements.loginPhone.value.trim()
                  try {
                    const result = await apiRequest('/auth/otp/request', {
                      method: 'POST',
                      body: JSON.stringify({ phone_number: phone, purpose: 'login' }),
                    })
                    setSellerAuthStatus(result.message)
                  } catch (error) {
                    setSellerAuthStatus(error.message)
                  }
                }}
              >
                Send OTP
              </button>
            </div>
            <button className="seller-primary-button" type="submit">Continue</button>
            <p className="seller-form-status" role="status" aria-live="polite">{sellerAuthStatus}</p>
          </form>
        ) : (
          <form
            className="seller-form"
            onSubmit={async (event) => {
              event.preventDefault()
              const formData = new FormData(event.currentTarget)
              if (!String(formData.get('nationalId') || '').trim()) {
                setSellerAuthStatus('National ID number is required.')
                return
              }
              const make = listingMakeChoice === OTHER_OPTION
                ? listingCustomMake.trim()
                : listingMakeChoice
              const model = listingMakeChoice === OTHER_OPTION || listingModelChoice === OTHER_OPTION
                ? listingCustomModel.trim()
                : listingModelChoice
              if (!make || !model) {
                setSellerAuthStatus('Choose a vehicle make and model, or enter them using Other.')
                return
              }
              const photoFields = [
                ['vehicle_photo_front', 'vehiclePhotoFront'],
                ['vehicle_photo_side', 'vehiclePhotoSide'],
                ['vehicle_photo_rear', 'vehiclePhotoRear'],
              ]
              if (photoFields.some(([, formField]) => !formData.get(formField)?.size)) {
                setSellerAuthStatus('Upload front, side, and rear vehicle photos to create a listing.')
                return
              }
              if (sellerOnlineSaleChoice && sellerImportedVehicleChoice === null) {
                setSellerAuthStatus('Choose whether the vehicle was imported.')
                return
              }
              const fullName = String(formData.get('fullName') || '').trim()
              const email = String(formData.get('email') || '').trim().toLowerCase()
              const phone = String(formData.get('phone') || '').trim()
              const nationalId = String(formData.get('nationalId') || '').trim()
              const interestNotifications = formData.get('interestNotifications') === 'accept'
              try {
                const authResponse = await apiRequest('/auth/register', {
                  method: 'POST',
                  body: JSON.stringify({
                    full_name: fullName,
                    email,
                    phone_number: phone,
                    national_id: nationalId,
                    role: 'seller',
                    otp: String(formData.get('signupOtp') || ''),
                    interest_notifications: interestNotifications,
                  }),
                })
                establishSession(authResponse)
                setSellerAuthStatus('Account verified. Creating your vehicle listing...')
                const car = await apiRequest('/cars', {
                  method: 'POST',
                  body: JSON.stringify({
                    make,
                    model,
                    year: Number(formData.get('year')),
                    mileage: Number(formData.get('mileage')),
                    price: String(formData.get('askingPrice')),
                    fuel_type: 'petrol',
                    transmission: sellerProfile.transmission,
                    plate: String(formData.get('plate') || '').trim(),
                    vehicle_type: `${make} ${model}`,
                    location: String(formData.get('sellerLocation') || '').trim(),
                    showroom: String(formData.get('showroom') || '').trim() || null,
                    online_sale: Boolean(sellerOnlineSaleChoice),
                    finance_status: null,
                    imported_vehicle: null,
                  }),
                })
                const fileForm = new FormData()
                fileForm.append('car_id', String(car.id))
                for (const [uploadField, formField] of photoFields) {
                  fileForm.append(uploadField, formData.get(formField))
                }
                if (sellerOnlineSaleChoice) {
                  fileForm.append('online_sale', 'true')
                  fileForm.append('online_sale_consent', String(formData.get('onlineSaleConsent') === 'on'))
                  fileForm.append('finance_status', String(formData.get('financeStatus') || ''))
                  fileForm.append('imported_vehicle', String(sellerImportedVehicleChoice))
                  fileForm.append('ecitizen_phone', String(formData.get('eCitizenPhone') || '').replace(/[\s().-]/g, ''))
                  fileForm.append('ownership', formData.get('ownershipDocumentName'))
                  fileForm.append('seller_id', formData.get('sellerIdDocumentName'))
                  if (sellerImportedVehicleChoice) {
                    fileForm.append('import_duty', formData.get('importDutyDocumentName'))
                  }
                  await apiRequest('/private-documents', { method: 'POST', body: fileForm })
                } else {
                  await apiRequest(`/cars/${car.id}/photos`, { method: 'POST', body: fileForm })
                }
                const savedCar = await apiRequest(`/cars/${car.id}`)
                const vehicle = mapCar(savedCar)
                setVehicleListings((listings) => [vehicle, ...listings])
                setSellerProfile((profile) => ({
                  ...profile,
                  fullName,
                  email,
                  phone,
                  nationalId,
                  vehicleMake: make,
                  vehicleModel: model,
                  vehicleYear: String(car.year),
                  mileage: String(car.mileage),
                  plate: car.plate || '',
                  sellerLocation: car.location || '',
                  transmission: car.transmission,
                  interestNotifications,
                  photos: vehicle.photos,
                }))
                setActiveView('Inventory')
                setSellerAuthStatus('')
              } catch (error) {
                setSellerAuthStatus(`Account or listing setup is incomplete: ${error.message} If your account was created, sign in and contact support before retrying to avoid duplicate accounts.`)
              }
            }}
          >
            <div className="seller-form-heading">
              <h2>Create your seller account</h2>
              <p>Enter your contact and identity details, then add the vehicle information for your listing.</p>
            </div>

            <div className="seller-form-section">
              <h3>Account details</h3>
              <div className="seller-form-grid">
                <label className="seller-field">
                  <span>Full name</span>
                  <input type="text" name="fullName" autoComplete="name" required />
                </label>
                <label className="seller-field">
                  <span>Email address</span>
                  <input type="email" name="email" autoComplete="email" required />
                </label>
                <label className="seller-field">
                  <span>Mobile phone number</span>
                  <input type="tel" name="phone" autoComplete="tel" placeholder="+254 7XX XXX XXX" required />
                </label>
                <label className="seller-field">
                  <span>National ID number (required)</span>
                  <input type="text" name="nationalId" autoComplete="off" pattern=".*\S.*" title="Enter your National ID number." required />
                </label>
              </div>
              <div className="seller-otp-field">
                <label className="seller-field">
                  <span>Phone verification code (OTP)</span>
                  <input
                    type="text"
                    name="signupOtp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    placeholder="6-digit code"
                    required
                  />
                </label>
                <button
                  className="seller-secondary-button"
                  type="button"
                  onClick={async (event) => {
                    const form = event.currentTarget.form
                    const values = new FormData(form)
                    try {
                      const result = await apiRequest('/auth/otp/request', {
                        method: 'POST',
                        body: JSON.stringify({
                          phone_number: String(values.get('phone') || '').trim(),
                          email: String(values.get('email') || '').trim().toLowerCase(),
                          full_name: String(values.get('fullName') || '').trim(),
                          purpose: 'signup',
                        }),
                      })
                      setSellerAuthStatus(result.message)
                    } catch (error) {
                      setSellerAuthStatus(error.message)
                    }
                  }}
                >
                  Send OTP
                </button>
              </div>
              <p className="seller-privacy-note">Your account is created only after the phone OTP is verified. SMS delivery requires the backend’s Twilio credentials.</p>
            </div>

            <fieldset className="seller-notification-choice">
              <legend>Customer interest notifications</legend>
              <p>Choose whether to receive a notification when a customer shows interest in one of your vehicles.</p>
              <label>
                <input type="radio" name="interestNotifications" value="accept" required />
                <span>Accept — notify me about interested customers</span>
              </label>
              <label>
                <input type="radio" name="interestNotifications" value="reject" required />
                <span>Reject — do not notify me</span>
              </label>
            </fieldset>

            <div className="seller-form-section">
              <h3>Vehicle listing details</h3>
              <div className="seller-form-grid">
                <label className="seller-field">
                  <span>Licence plate / registration number</span>
                  <input type="text" name="plate" autoComplete="off" required />
                </label>
                <AnimatedDropdown
                  id="listing-make"
                  label="Make"
                  name="makeChoice"
                  value={listingMakeChoice}
                  options={[
                    ...vehicleMakes.map((make) => ({ value: make, label: make })),
                    { value: OTHER_OPTION, label: 'Other' },
                  ]}
                  onChange={(make) => {
                    setListingMakeChoice(make)
                    setListingModelChoice('')
                    setListingCustomModel('')
                  }}
                  required
                />
                {listingMakeChoice === OTHER_OPTION && (
                  <label className="seller-field">
                    <span>Enter make</span>
                    <input type="text" name="make" value={listingCustomMake} onChange={(event) => setListingCustomMake(event.target.value)} required />
                  </label>
                )}
                {listingMakeChoice && listingMakeChoice !== OTHER_OPTION && (
                  <>
                    <AnimatedDropdown
                      id="listing-model"
                      label="Model"
                      name="modelChoice"
                      value={listingModelChoice}
                      options={[
                        ...listingModelOptions.map((model) => ({ value: model, label: model })),
                        { value: OTHER_OPTION, label: 'Other' },
                      ]}
                      onChange={setListingModelChoice}
                      required
                    />
                    {listingModelChoice === OTHER_OPTION && (
                      <label className="seller-field">
                        <span>Enter model</span>
                        <input type="text" name="model" value={listingCustomModel} onChange={(event) => setListingCustomModel(event.target.value)} required />
                      </label>
                    )}
                  </>
                )}
                {listingMakeChoice === OTHER_OPTION && (
                  <label className="seller-field">
                    <span>Model</span>
                    <input type="text" name="model" value={listingCustomModel} onChange={(event) => setListingCustomModel(event.target.value)} required />
                  </label>
                )}
                <label className="seller-field">
                  <span>Year of manufacture</span>
                  <input type="number" name="year" min="1900" max={new Date().getFullYear() + 1} required />
                </label>
                <label className="seller-field">
                  <span>Mileage (km)</span>
                  <input type="number" name="mileage" min="0" required />
                </label>
                <AnimatedDropdown
                  id="listing-transmission"
                  label="Transmission"
                  name="transmission"
                  value={sellerProfile.transmission}
                  options={[
                    { value: 'automatic', label: 'Automatic' },
                    { value: 'manual', label: 'Manual' },
                    { value: 'other', label: 'Other' },
                  ]}
                  onChange={(transmission) => setSellerProfile((profile) => ({ ...profile, transmission }))}
                  required
                />
                <label className="seller-field">
                  <span>Asking price (KES)</span>
                  <input type="number" name="askingPrice" min="1" step="1" required />
                </label>
                <label className="seller-field">
                  <span>Seller location</span>
                  <input type="text" name="sellerLocation" autoComplete="address-level2" placeholder="Town or city" required />
                </label>
                <label className="seller-field">
                  <span>Showroom (optional)</span>
                  <input type="text" name="showroom" autoComplete="organization" />
                </label>
              </div>
            </div>
            <div className="seller-form-section">
              <h3>Vehicle photos</h3>
              <p className="seller-privacy-note">Photos are stored securely with the vehicle listing. Upload up to three JPEG, PNG, or WebP images.</p>
              <div className="seller-form-grid">
                {['Front', 'Side', 'Rear'].map((position) => (
                  <label className="seller-field" key={position}>
                    <span>{position} photo</span>
                    <input
                      type="file"
                      name={`vehiclePhoto${position}`}
                      accept="image/jpeg,image/png,image/webp"
                      required
                    />
                  </label>
                ))}
              </div>
            </div>
            <fieldset className="seller-notification-choice">
              <legend>Sale method</legend>
              <p>Choose whether you are willing to complete the sale online. Buyers will only see your choice; private documents are not displayed.</p>
              <label>
                <input
                  type="radio"
                  name="onlineSale"
                  value="yes"
                  checked={sellerOnlineSaleChoice}
                  required
                  onChange={() => setSellerOnlineSaleChoice(true)}
                />
                <span>Yes — I am willing to conduct this sale online</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="onlineSale"
                  value="no"
                  checked={sellerOnlineSaleChoice === false}
                  required
                  onChange={() => setSellerOnlineSaleChoice(false)}
                />
                <span>No — arrange the sale directly with me</span>
              </label>
            </fieldset>
            {sellerOnlineSaleChoice && (
              <div className="seller-form-section online-sale-documents">
                <h3>Online sale checks</h3>
                <p className="seller-privacy-note">Ownership, National ID and (if imported) import documents are stored privately. Only administrators may review them. Never enter an eCitizen password.</p>
                <label className="seller-notification-choice">
                  <input type="checkbox" name="onlineSaleConsent" required />
                  <span>I confirm these ownership and legal-status details are accurate and consent to administrator verification.</span>
                </label>
                {sellerAuthStatus && <p className="seller-form-status" role="alert">{sellerAuthStatus}</p>}
                <div className="seller-form-grid">
                  <label className="seller-field">
                    <span>Proof of ownership / title / logbook (PDF or image)</span>
                    <input type="file" name="ownershipDocumentName" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" required onChange={(event) => updateLegalDocument('ownership', event.target.files?.[0], setSellerProfile, event.target)} />
                  </label>
                  <label className="seller-field">
                    <span>Seller National ID document (PDF or image)</span>
                    <input type="file" name="sellerIdDocumentName" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" required onChange={(event) => updateLegalDocument('sellerId', event.target.files?.[0], setSellerProfile, event.target)} />
                  </label>
                  <label className="seller-field">
                    <span>Title / finance / lease status</span>
                    <select name="financeStatus" defaultValue="" required>
                      <option value="" disabled>Select status</option>
                      <option value="clear">No active loan, finance, or lease</option>
                      <option value="active-finance">Active loan or finance</option>
                      <option value="active-lease">Active lease</option>
                    </select>
                  </label>
                  <label className="seller-field">
                    <span>Registered eCitizen phone number (no password)</span>
                    <input type="tel" name="eCitizenPhone" autoComplete="tel" placeholder="+254 7XX XXX XXX" required />
                  </label>
                </div>
                <fieldset className="seller-notification-choice">
                  <legend>Vehicle import status</legend>
                  <label>
                    <input type="radio" name="sellerImportedVehicle" value="yes" checked={sellerImportedVehicleChoice} onChange={() => setSellerImportedVehicleChoice(true)} required />
                    <span>Imported — I can provide import / duty verification</span>
                  </label>
                  <label>
                    <input type="radio" name="sellerImportedVehicle" value="no" checked={sellerImportedVehicleChoice === false} onChange={() => setSellerImportedVehicleChoice(false)} required />
                    <span>Not imported</span>
                  </label>
                </fieldset>
                {sellerImportedVehicleChoice && (
                  <label className="seller-field">
                    <span>Import / export / duty verification document (PDF or image)</span>
                    <input type="file" name="importDutyDocumentName" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" required onChange={(event) => updateLegalDocument('importDuty', event.target.files?.[0], setSellerProfile, event.target)} />
                  </label>
                )}
              </div>
            )}
            <button className="seller-primary-button" type="submit">Create account & prepare listing</button>
            <p className="seller-form-status" role="status" aria-live="polite">{sellerAuthStatus}</p>
          </form>
        )}
      </div>
    </section>
  )

  const renderManagerAccess = () => (
    <section className="content seller-access-content">
      <div className="seller-access-heading">
        <p className="seller-eyebrow">Staff portal</p>
        <h1>Manager login</h1>
        <p>Sign in with the manager account provisioned by the backend operator.</p>
      </div>
      <div className="seller-access-card">
        <form
          className="seller-form"
          onSubmit={async (event) => {
            event.preventDefault()
            const values = new FormData(event.currentTarget)
            try {
              const authResponse = await apiRequest('/auth/login', {
                method: 'POST',
                body: JSON.stringify({
                  email: String(values.get('managerLoginEmail') || '').trim().toLowerCase(),
                  password: values.get('managerLoginPassword'),
                }),
              })
              if (!['manager', 'admin'].includes(authResponse.user.role)) {
                setManagerAuthStatus('This account does not have manager access.')
                return
              }
              establishSession(authResponse)
              setManagerAuthStatus('')
            } catch (error) {
              setManagerAuthStatus(error.message)
            }
          }}
        >
          <label className="seller-field">
            <span>Email address</span>
            <input type="email" name="managerLoginEmail" autoComplete="username" required />
          </label>
          <label className="seller-field">
            <span>Password</span>
            <input type="password" name="managerLoginPassword" autoComplete="current-password" required />
          </label>
          <button className="seller-primary-button" type="submit">Manager sign in</button>
          <p className="seller-form-status" role="status" aria-live="polite">{managerAuthStatus}</p>
        </form>
      </div>
    </section>
  )

  const renderBuyerAccess = () => (
    <section className="content seller-access-content">
      <div className="seller-access-heading">
        <p className="seller-eyebrow">Buyer portal</p>
        <h1>Welcome to Volt Motors</h1>
        <p>Sign in to view full vehicle profiles and contact sellers.</p>
      </div>
      <div className="seller-access-card buyer-access-card">
        <div className="seller-auth-tabs" role="tablist" aria-label="Buyer account options">
          <button
            type="button"
            role="tab"
            aria-selected={buyerAuthMode === 'login'}
            className={buyerAuthMode === 'login' ? 'active' : ''}
            onClick={() => {
              setBuyerAuthMode('login')
              setBuyerAuthStatus('')
            }}
          >
            Buyer login
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={buyerAuthMode === 'signup'}
            className={buyerAuthMode === 'signup' ? 'active' : ''}
            onClick={() => {
              setBuyerAuthMode('signup')
              setBuyerAuthStatus('')
            }}
          >
            Create buyer account
          </button>
        </div>

        {buyerAuthMode === 'login' ? (
          <form
            className="seller-form"
            onSubmit={async (event) => {
              event.preventDefault()
              const formData = new FormData(event.currentTarget)
              const phone = String(formData.get('buyerLoginPhone') || '').trim()
              const otp = String(formData.get('buyerLoginOtp') || '')
              try {
                const authResponse = await apiRequest('/auth/otp/verify', {
                  method: 'POST',
                  body: JSON.stringify({ phone_number: phone, otp }),
                })
                if (authResponse.user.role !== 'buyer') {
                  setBuyerAuthStatus('This verified phone number is not registered as a buyer account.')
                  return
                }
                establishSession(authResponse)
                setBuyerAuthStatus('')
              } catch (error) {
                setBuyerAuthStatus(error.message)
              }
            }}
          >
            <div className="seller-form-heading">
              <h2>Welcome back</h2>
              <p>Sign in with your registered mobile number and one-time password.</p>
            </div>
            <label className="seller-field">
              <span>Mobile phone number</span>
              <input type="tel" name="buyerLoginPhone" autoComplete="tel" placeholder="+254 7XX XXX XXX" required />
            </label>
            <div className="seller-otp-field">
              <label className="seller-field">
                <span>One-time password (OTP)</span>
                <input type="text" name="buyerLoginOtp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="6-digit code" required />
              </label>
              <button
                className="seller-secondary-button"
                type="button"
                onClick={async (event) => {
                  const phone = event.currentTarget.form.elements.buyerLoginPhone.value.trim()
                  try {
                    const result = await apiRequest('/auth/otp/request', {
                      method: 'POST',
                      body: JSON.stringify({ phone_number: phone, purpose: 'login' }),
                    })
                    setBuyerAuthStatus(result.message)
                  } catch (error) {
                    setBuyerAuthStatus(error.message)
                  }
                }}
              >
                Send OTP
              </button>
            </div>
            <button className="seller-primary-button" type="submit">Continue</button>
            <p className="seller-form-status" role="status" aria-live="polite">{buyerAuthStatus}</p>
          </form>
        ) : (
          <form
            className="seller-form"
            onSubmit={async (event) => {
              event.preventDefault()
              const formData = new FormData(event.currentTarget)
              if (!String(formData.get('buyerFullName') || '').trim()) {
                setBuyerAuthStatus('Full name is required.')
                return
              }
              if (!String(formData.get('buyerNationalId') || '').trim()) {
                setBuyerAuthStatus('National ID number is required.')
                return
              }
              try {
                const authResponse = await apiRequest('/auth/register', {
                  method: 'POST',
                  body: JSON.stringify({
                    full_name: String(formData.get('buyerFullName') || '').trim(),
                    email: String(formData.get('buyerEmail') || '').trim().toLowerCase(),
                    phone_number: String(formData.get('buyerPhone') || '').trim(),
                    national_id: String(formData.get('buyerNationalId') || '').trim(),
                    role: 'buyer',
                    otp: String(formData.get('buyerSignupOtp') || ''),
                  }),
                })
                establishSession(authResponse)
                setBuyerAuthStatus('')
              } catch (error) {
                setBuyerAuthStatus(error.message)
              }
            }}
          >
            <div className="seller-form-heading">
              <h2>Create your buyer account</h2>
              <p>Provide your contact details and verify your phone. No vehicle information is required.</p>
            </div>
            <div className="seller-form-grid">
              <label className="seller-field">
                <span>Full name</span>
                <input type="text" name="buyerFullName" autoComplete="name" required />
              </label>
              <label className="seller-field">
                <span>Email address</span>
                <input type="email" name="buyerEmail" autoComplete="email" required />
              </label>
              <label className="seller-field">
                <span>Mobile phone number</span>
                <input type="tel" name="buyerPhone" autoComplete="tel" placeholder="+254 7XX XXX XXX" required />
              </label>
              <label className="seller-field">
                <span>National ID number (required)</span>
                <input type="text" name="buyerNationalId" autoComplete="off" pattern=".*\S.*" title="Enter your National ID number." required />
              </label>
            </div>
            <div className="seller-otp-field">
              <label className="seller-field">
                <span>Phone verification code (OTP)</span>
                <input type="text" name="buyerSignupOtp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="6-digit code" required />
              </label>
              <button
                className="seller-secondary-button"
                type="button"
                onClick={async (event) => {
                  const values = new FormData(event.currentTarget.form)
                  try {
                    const result = await apiRequest('/auth/otp/request', {
                      method: 'POST',
                      body: JSON.stringify({
                        phone_number: String(values.get('buyerPhone') || '').trim(),
                        email: String(values.get('buyerEmail') || '').trim().toLowerCase(),
                        full_name: String(values.get('buyerFullName') || '').trim(),
                        purpose: 'signup',
                      }),
                    })
                    setBuyerAuthStatus(result.message)
                  } catch (error) {
                    setBuyerAuthStatus(error.message)
                  }
                }}
              >
                Send OTP
              </button>
            </div>
            <p className="seller-privacy-note">Account creation requires an SMS verification code sent to your phone.</p>
            <button className="seller-primary-button" type="submit">Create buyer account</button>
            <p className="seller-form-status" role="status" aria-live="polite">{buyerAuthStatus}</p>
          </form>
        )}
      </div>
    </section>
  )

  const renderInventory = () => (
    <section className="content">
      <h1>Inventory</h1>
      {inventoryStatus && <p className="seller-form-status" role="alert">{inventoryStatus}</p>}
      {vehicleListings.length === 0 && !inventoryStatus && (
        <p className="seller-privacy-note">No vehicles are currently listed.</p>
      )}
      <div className="inventory-grid">
        {vehicleListings.map((vehicle) => (
          <article
            key={vehicle.id}
            className={`inventory-card${userRole === 'guest' ? ' inventory-card-locked' : ''}`}
            role="button"
            tabIndex={0}
            aria-label={userRole === 'guest' ? `Log in to view ${vehicle.name} profile` : `View ${vehicle.name} profile`}
            onClick={() => {
              if (userRole === 'guest') {
                setBuyerAuthStatus('')
                setActiveView('Buyer Login')
                return
              }
              openVehicleProfile(vehicle)
            }}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                if (userRole === 'guest') {
                  setBuyerAuthStatus('')
                  setActiveView('Buyer Login')
                } else {
                  openVehicleProfile(vehicle)
                }
              }
            }}
          >
            <img src={vehicle.photos[0] ? apiUrl(vehicle.photos[0]) : PLACEHOLDER_VEHICLE_IMAGE} alt={vehicle.name} />
            <div className="inventory-body">
              <div className="inventory-headline">
                <h3>
                  <span className="vehicle-name">{vehicle.name}</span>
                  {vehicle.verified && (
                    <span className="verified-badge" aria-label="Verified vehicle" title="Verified vehicle">
                      <svg viewBox="0 0 16 16" aria-hidden="true">
                        <path d="m3.5 8.2 2.8 2.7 6.2-6.1" />
                      </svg>
                    </span>
                  )}
                </h3>
              </div>
              <div className="meta-row">
                <strong>Contact Name</strong>
                <span>{vehicle.contactName}</span>
              </div>
              <div className="meta-row">
                <strong>Contact</strong>
                <span>{vehicle.contact}</span>
              </div>
              <div className="meta-row">
                <strong>Location</strong>
                <span>{vehicle.location}</span>
              </div>
              {userRole === 'buyer' && (
                <>
                  <p className="online-sale-availability">
                    Online sale: <strong>{vehicle.onlineSale ? 'Available' : 'Not offered'}</strong>
                  </p>
                  <button
                    className={`interested-button${interestedVehicleIds.includes(vehicle.id) ? ' is-interested' : ''}`}
                    type="button"
                    aria-pressed={interestedVehicleIds.includes(vehicle.id)}
                    onClick={(event) => {
                      event.stopPropagation()
                      toggleInterestedVehicle(vehicle.id)
                    }}
                  >
                    {interestedVehicleIds.includes(vehicle.id) ? 'Added to cart' : 'Interested'}
                  </button>
                </>
              )}
              {userRole === 'guest' && <p className="inventory-login-hint">Log in to view vehicle details</p>}
            </div>
          </article>
        ))}
      </div>
    </section>
  )

  const renderSettings = () => (
    <section className="content seller-access-content">
      <div className="seller-access-heading">
        <p className="seller-eyebrow">Account settings</p>
        <h1>Profile & vehicle KYC</h1>
        <p>Update your contact and identity details, registration plate, vehicle details, and three clear vehicle photos.</p>
      </div>
      <div className="settings-actions">
        {!isEditingSettings && (
          <button
            className="seller-primary-button"
            type="button"
            onClick={() => {
              setSellerDraft({ ...sellerProfile, photos: [...sellerProfile.photos] })
              setSellerPhotoUploads([null, null, null])
              setSettingsStatus('')
              setIsEditingSettings(true)
            }}
          >
            Update profile and vehicle KYC
          </button>
        )}
      </div>
      <form className={`seller-access-card settings-card${isEditingSettings ? ' is-editing' : ''}`} onSubmit={updateSellerProfile}>
        <div className="seller-form">
          <div className="seller-form-section">
            <h3>Seller identity</h3>
            <div className="seller-form-grid">
              <label className="seller-field">
                <span>Full name</span>
                <input name="fullName" autoComplete="name" value={sellerDraft.fullName} disabled={!isEditingSettings} onChange={(event) => setSellerDraft({ ...sellerDraft, fullName: event.target.value })} required />
              </label>
              <label className="seller-field">
                <span>Email address</span>
                <input name="email" type="email" autoComplete="email" value={sellerDraft.email} disabled={!isEditingSettings} onChange={(event) => setSellerDraft({ ...sellerDraft, email: event.target.value })} required />
              </label>
              <label className="seller-field">
                <span>Mobile phone number</span>
                <input name="phone" type="tel" autoComplete="tel" value={sellerDraft.phone} disabled={!isEditingSettings} onChange={(event) => setSellerDraft({ ...sellerDraft, phone: event.target.value })} required />
              </label>
              <label className="seller-field">
                <span>National ID number (required)</span>
                <input name="nationalId" autoComplete="off" pattern=".*\S.*" title="Enter your National ID number." value={sellerDraft.nationalId} disabled={!isEditingSettings} onChange={(event) => setSellerDraft({ ...sellerDraft, nationalId: event.target.value })} required />
              </label>
            </div>
          </div>

          <div className="seller-form-section">
            <h3>Vehicle KYC</h3>
            <div className="seller-form-grid">
              <AnimatedDropdown
                id="settings-make"
                label="Make"
                name="vehicleMakeChoice"
                value={settingsMakeChoice}
                options={[
                  ...vehicleMakes.map((make) => ({ value: make, label: make })),
                  { value: OTHER_OPTION, label: 'Other' },
                ]}
                onChange={(make) => setSellerDraft({
                  ...sellerDraft,
                  vehicleMake: make === OTHER_OPTION ? (vehicleMakes.includes(sellerDraft.vehicleMake) ? '' : sellerDraft.vehicleMake) : make,
                  vehicleModel: '',
                })}
                required
                disabled={!isEditingSettings}
              />
              {settingsMakeChoice === OTHER_OPTION && (
                <label className="seller-field">
                  <span>Enter make</span>
                  <input name="vehicleMake" value={sellerDraft.vehicleMake} disabled={!isEditingSettings} onChange={(event) => setSellerDraft({ ...sellerDraft, vehicleMake: event.target.value })} required />
                </label>
              )}
              {vehicleModelsByMake[sellerDraft.vehicleMake] && (
                <AnimatedDropdown
                  id="settings-model"
                  label="Model"
                  name="vehicleModelChoice"
                  value={settingsModelChoice}
                  options={[
                    ...settingsModelOptions.map((model) => ({ value: model, label: model })),
                    { value: OTHER_OPTION, label: 'Other' },
                  ]}
                  onChange={(model) => setSellerDraft({
                    ...sellerDraft,
                    vehicleModel: model === OTHER_OPTION ? (settingsModelOptions.includes(sellerDraft.vehicleModel) ? '' : sellerDraft.vehicleModel) : model,
                  })}
                  required
                  disabled={!isEditingSettings}
                />
              )}
              {(settingsMakeChoice === OTHER_OPTION || settingsModelChoice === OTHER_OPTION) && (
                <label className="seller-field">
                  <span>Enter model</span>
                  <input name="vehicleModel" value={sellerDraft.vehicleModel} disabled={!isEditingSettings} onChange={(event) => setSellerDraft({ ...sellerDraft, vehicleModel: event.target.value })} required />
                </label>
              )}
              <label className="seller-field">
                <span>Year of manufacture</span>
                <input name="vehicleYear" type="number" min="1900" max={new Date().getFullYear() + 1} value={sellerDraft.vehicleYear} disabled={!isEditingSettings} onChange={(event) => setSellerDraft({ ...sellerDraft, vehicleYear: event.target.value })} required />
              </label>
              <label className="seller-field">
                <span>Mileage (km)</span>
                <input name="mileage" type="number" min="0" value={sellerDraft.mileage} disabled={!isEditingSettings} onChange={(event) => setSellerDraft({ ...sellerDraft, mileage: event.target.value })} required />
              </label>
              <label className="seller-field">
                <span>Licence plate</span>
                <input name="plate" value={sellerDraft.plate} disabled={!isEditingSettings} onChange={(event) => setSellerDraft({ ...sellerDraft, plate: event.target.value })} required />
              </label>
              <label className="seller-field">
                <span>Seller location</span>
                <input name="sellerLocation" value={sellerDraft.sellerLocation} disabled={!isEditingSettings} onChange={(event) => setSellerDraft({ ...sellerDraft, sellerLocation: event.target.value })} required />
              </label>
              <AnimatedDropdown
                id="settings-transmission"
                label="Transmission"
                name="transmission"
                value={sellerDraft.transmission}
                options={[
                  { value: 'automatic', label: 'Automatic' },
                  { value: 'manual', label: 'Manual' },
                  { value: 'other', label: 'Other' },
                ]}
                onChange={(transmission) => setSellerDraft({ ...sellerDraft, transmission })}
                required
                disabled={!isEditingSettings}
              />
            </div>
          </div>

          <fieldset className="seller-notification-choice">
            <legend>Customer interest notifications</legend>
            <p>Current preference: {sellerDraft.interestNotifications ? 'Accepted' : 'Rejected / not enabled'}.</p>
            <label>
              <input
                type="radio"
                name="settingsInterestNotifications"
                value="accept"
                checked={sellerDraft.interestNotifications === true}
                disabled={!isEditingSettings}
                onChange={() => setSellerDraft({ ...sellerDraft, interestNotifications: true })}
              />
              <span>Accept — notify me about interested customers</span>
            </label>
            <label>
              <input
                type="radio"
                name="settingsInterestNotifications"
                value="reject"
                checked={sellerDraft.interestNotifications === false}
                disabled={!isEditingSettings}
                onChange={() => setSellerDraft({ ...sellerDraft, interestNotifications: false })}
              />
              <span>Reject — do not notify me</span>
            </label>
            <p className="seller-privacy-note">Notification delivery requires a connected account and messaging service.</p>
          </fieldset>

          <div className="seller-form-section">
            <h3>Vehicle photos</h3>
            <p className="seller-privacy-note">Upload three clear photos. On supported phones, the camera option opens the rear camera; device upload lets you choose an existing image.</p>
            <div className="kyc-photo-grid">
              {sellerDraft.photos.map((photo, index) => (
                <div className="kyc-photo-item" key={`kyc-photo-${index + 1}`}>
                  <div className="kyc-photo-preview">
                    {photo ? <img src={photo.startsWith('data:') ? photo : apiUrl(photo)} alt={`Vehicle photo ${index + 1} preview`} /> : <span>Photo {index + 1}</span>}
                  </div>
                  <label className="seller-field">
                    <span>Take photo {index + 1}</span>
                    <input type="file" accept="image/*" capture="environment" disabled={!isEditingSettings} onChange={(event) => updateProfilePhoto(index, event.target.files?.[0])} />
                  </label>
                  <label className="seller-field">
                    <span>Choose from device</span>
                    <input type="file" accept="image/*" disabled={!isEditingSettings} onChange={(event) => updateProfilePhoto(index, event.target.files?.[0])} />
                  </label>
                </div>
              ))}
            </div>
          </div>
          <p className="seller-privacy-note">Identity and listing changes save to your account. Vehicle photos are stored securely; private legal documents can only be accessed by administrators.</p>
          {isEditingSettings && (
            <div className="settings-form-actions">
              <button className="seller-secondary-button" type="button" onClick={() => {
                setSellerDraft({ ...sellerProfile, photos: [...sellerProfile.photos] })
                setSellerPhotoUploads([null, null, null])
                setIsEditingSettings(false)
                setSettingsStatus('Changes discarded.')
              }}>Cancel</button>
              <button className="seller-primary-button" type="submit">Save changes</button>
            </div>
          )}
          <button className="seller-logout-button" type="button" onClick={logoutSeller}>Log out</button>
          <p className="seller-form-status" role="status" aria-live="polite">{settingsStatus}</p>
        </div>
      </form>
    </section>
  )

  const renderBuyerSettings = () => (
    <section className="content seller-access-content">
      <div className="seller-access-heading">
        <p className="seller-eyebrow">Buyer account</p>
        <h1>Account settings</h1>
        <p>You are signed in as {currentUser?.email}. Sign out here to return to guest browsing.</p>
      </div>
      <div className="seller-access-card buyer-settings-card">
        <div className="seller-form">
          <div className="seller-form-heading">
            <h2>Buyer profile</h2>
            <p>{currentUser?.email}</p>
          </div>
          <button className="seller-logout-button" type="button" onClick={logoutBuyer}>Log out</button>
        </div>
      </div>
    </section>
  )

  const renderBuyerCart = () => {
    const cartVehicles = vehicleListings.filter((vehicle) => interestedVehicleIds.includes(vehicle.id))

    return (
      <section className="content">
        <div className="cart-heading">
          <div>
            <h1>Your interested vehicles</h1>
            <p>{cartVehicles.length} {cartVehicles.length === 1 ? 'vehicle' : 'vehicles'} saved</p>
          </div>
          <button className="seller-secondary-button" type="button" onClick={() => setActiveView('Inventory')}>
            Browse inventory
          </button>
        </div>
        {cartVehicles.length === 0 ? (
          <div className="buyer-cart-empty">
            <h2>Your cart is empty</h2>
            <p>Mark vehicles as Interested in the inventory to keep them here.</p>
          </div>
        ) : (
          <div className="buyer-cart-list">
            {cartVehicles.map((vehicle) => (
              <article className="buyer-cart-item" key={vehicle.id}>
                <img src={vehicle.photos[0] ? apiUrl(vehicle.photos[0]) : PLACEHOLDER_VEHICLE_IMAGE} alt={vehicle.name} />
                <div className="buyer-cart-details">
                  <h2>{vehicle.name}</h2>
                  <p>{vehicle.type} · {vehicle.year} · {vehicle.mileage.toLocaleString()} km</p>
                  <p>{vehicle.contactName} · {vehicle.location}</p>
                  <p className="online-sale-availability">
                    Online sale: <strong>{vehicle.onlineSale ? 'Available' : 'Not offered'}</strong>
                  </p>
                  <span>{vehicle.contact}</span>
                </div>
                <div className="buyer-cart-actions">
                  <a
                    className="vehicle-call-button"
                    href={`tel:${vehicle.contact.replace(/[^\d+]/g, '')}`}
                    aria-label={`Call ${vehicle.contactName} about ${vehicle.name}`}
                  >
                    Call owner
                  </a>
                  <button
                    className="vehicle-chat-button"
                    type="button"
                    onClick={() => openVehicleChat(vehicle)}
                    aria-label={`Chat with ${vehicle.contactName} about ${vehicle.name}`}
                  >
                    Chat
                  </button>
                  <button
                    className="buyer-cart-remove"
                    type="button"
                    onClick={() => toggleInterestedVehicle(vehicle.id)}
                    aria-label={`Remove ${vehicle.name} from cart`}
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    )
  }

  const renderContent = () => {
    if (authLoading) return <section className="content"><p>Checking your session…</p></section>
    if (activeView === 'Customers' && userRole === 'admin') return renderCustomers()
    if (activeView === 'Documents' && userRole === 'admin') return renderAdminDocuments()
    if (activeView === 'Inventory') return renderInventory()
    if (activeView === 'Cart' && userRole === 'buyer') return renderBuyerCart()
    if (activeView === 'Seller Login' && userRole !== 'seller') return renderSellerAccess()
    if (activeView === 'Buyer Login' && userRole === 'guest') return renderBuyerAccess()
    if (activeView === 'Manager Login' && userRole === 'guest') return renderManagerAccess()
    if (activeView === 'Settings' && userRole === 'buyer') return renderBuyerSettings()
    if (activeView === 'Settings' && userRole === 'manager') {
      return (
        <section className="content seller-access-content">
          <h1>Manager settings</h1>
          <p>{currentUser?.email}</p>
          <button className="seller-logout-button" type="button" onClick={logout}>Log out</button>
        </section>
      )
    }
    if (activeView === 'Settings' && userRole === 'seller') return renderSettings()
    if (userRole === 'admin') return renderDashboard()
    return renderInventory()
  }

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6.5 7.8A7.5 7.5 0 0 1 14.2 5h.5v2.6h-3.1a4.4 4.4 0 0 0-4.4 4.4v.8h2.5v-2.3c0-.9.6-1.5 1.4-1.5h1.2c.8 0 1.4.6 1.4 1.5v1.7H15v2.6h-2.7v3.5h-2.6v-3.5H7.2v-2.6h3.1v-1.5A4.4 4.4 0 0 0 6.5 7.8Zm2.1 7.7h2.6v2.7H8.6v-2.7Z" fill="currentColor" />
              <path d="M4.6 12.5a7.4 7.4 0 0 1 14.8 0v.8a7.4 7.4 0 0 1-14.8 0v-.8Zm7.4 5.3a5.2 5.2 0 0 0 5.2-5.2v-.3a5.2 5.2 0 0 0-10.4 0v.3a5.2 5.2 0 0 0 5.2 5.2Z" fill="currentColor" opacity="0.75" />
            </svg>
          </span>
          Volt Motors
        </div>

        <nav className="sidebar-nav" aria-label="Sidebar navigation">
          {navItems.map((item) => (
            <button
              key={item.label}
              className={`nav-item${activeView === item.view ? ' active' : ''}`}
              type="button"
              onClick={() => setActiveView(item.view)}
            >
              <span className="nav-icon">
                {item.label === 'Dashboard' && (
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.8V5.5h7.5v7.3H4Zm8.5 0V4h7.5v8.8h-7.5ZM4 18.5v-5.4h7.5v5.4H4Zm8.5 0v-3.7h7.5v3.7h-7.5Z" fill="currentColor" /></svg>
                )}
                {item.label === 'Inventory' && (
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 8.5V6.2A2.2 2.2 0 0 1 9.7 4h4.6a2.2 2.2 0 0 1 2.2 2.2v2.3h1.5c1.1 0 2 .9 2 2v7.8a2.1 2.1 0 0 1-2 2.1H6c-1.1 0-2-.9-2-2.1V10.5c0-1.1.9-2 2-2h1.5Zm2 0h5V6.2a.7.7 0 0 0-.7-.7H10.2a.7.7 0 0 0-.7.7V8.5Z" fill="currentColor" /></svg>
                )}
                {item.label === 'Cart' && (
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h8.3a2 2 0 0 0 1.9-1.4L21 8H6M10 20a1.2 1.2 0 1 0 0-2.4A1.2 1.2 0 0 0 10 20Zm7 0a1.2 1.2 0 1 0 0-2.4A1.2 1.2 0 0 0 17 20Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                )}
                {item.label === 'Customers' && (
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 10.8a3.3 3.3 0 1 1 6.6 0 3.3 3.3 0 0 1-6.6 0Zm8.6 1.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Zm-11.3 2.5c0-1.8 2.1-3.1 4.8-3.1 2.6 0 4.8 1.3 4.8 3.1v1.6H4.5v-1.6Zm13.8 0c0-1.3 1.4-2.3 3.2-2.8v1.7c-.8.3-1.4.8-1.7 1.3v1.4h-1.5v-1.6Z" fill="currentColor" /></svg>
                )}
                {(item.label === 'Seller Login' || item.label === 'Buyer Login') && (
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4.1 0-7 2.1-7 4.5V21h14v-2.5c0-2.4-2.9-4.5-7-4.5Z" fill="currentColor" /></svg>
                )}
                {item.label === 'Settings' && (
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.4 13a7.7 7.7 0 0 0 0-2l2-1.5-2-3.4-2.4 1a7.7 7.7 0 0 0-1.7-1L15 3.5h-4l-.4 2.6a7.7 7.7 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.5a7.7 7.7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7.7 7.7 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7.7 7.7 0 0 0 1.7-1l2.4 1 2-3.4-2.1-1.5ZM13 14.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" fill="currentColor" /></svg>
                )}
              </span>
              <span>{item.label}</span>
              {item.label === 'Cart' && interestedVehicleIds.length > 0 && (
                <span className="cart-count" aria-label={`${interestedVehicleIds.length} vehicles in cart`}>{interestedVehicleIds.length}</span>
              )}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-actions">
            <button className="icon-button" type="button" aria-label="settings" onClick={() => setActiveView('Settings')}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.1 12.6a7.8 7.8 0 0 0 .1-1.2l2-1.5-2-3.4-2.4 1a7.7 7.7 0 0 0-2.1-1.2L13.8 3h-3.6l-.5 2.3a7.7 7.7 0 0 0-2.1 1.2l-2.4-1-2 3.4 2 1.5a7.8 7.8 0 0 0 0 2.4l-2 1.5 2 3.4 2.4-1c.7.5 1.4.9 2.1 1.2l.5 2.3h3.6l.5-2.3c.7-.3 1.4-.7 2.1-1.2l2.4 1 2-3.4-2-1.5ZM12 15.3A3.3 3.3 0 1 1 12 8.7a3.3 3.3 0 0 1 0 6.6Z" fill="currentColor" /></svg>
            </button>
            <button className="icon-button" type="button" aria-label="notifications">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5a4.3 4.3 0 0 1 4.3 4.3v2.2c0 1.1.4 2.2 1.2 3l1.1 1.2h-13.2l1.1-1.2c.8-.8 1.2-1.9 1.2-3V8.8A4.3 4.3 0 0 1 12 4.5Zm0 15.1c-1.5 0-2.8-.9-3.3-2.2h6.6c-.5 1.3-1.8 2.2-3.3 2.2Z" fill="currentColor" /></svg>
            </button>
            <button className="icon-button small" type="button" aria-label="toggle"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.2 4.4h.1V2.8h-1.3v1.6h.1a7.8 7.8 0 1 0 7.8 7.8h1.6A9.4 9.4 0 0 1 13.2 4.4Zm-1.5 1.4h.1A7.8 7.8 0 0 1 19.6 13h-1.6a6.2 6.2 0 1 0-7.1 6.1v1.6A7.8 7.8 0 0 1 11.7 5.8Zm-.5 4.4h-2v1.6h2v2h1.6v-2h2v-1.6h-2v-2h-1.6v2Z" fill="currentColor" /></svg></button>
          </div>
        </header>

        {renderContent()}
        <footer className="app-footer">
          © {new Date().getFullYear()} Volt Motors. All rights reserved.
        </footer>
      </main>
      {selectedVehicle && (
        <div
          className="vehicle-modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelectedVehicle(null)
          }}
        >
          <section className="vehicle-modal" role="dialog" aria-modal="true" aria-labelledby="vehicle-modal-title">
            <button
              className="vehicle-modal-close"
              type="button"
              aria-label="Close vehicle profile"
              onClick={() => setSelectedVehicle(null)}
            >
              &times;
            </button>
            <div className="vehicle-modal-heading">
              <div>
                <h2 id="vehicle-modal-title">{selectedVehicle.name}</h2>
                <p>{selectedVehicle.type} · {selectedVehicle.location} · {selectedVehicle.mileage.toLocaleString()} km</p>
              </div>
              {selectedVehicle.verified && (
                <span className="modal-verified-label">
                  <span className="verified-badge" aria-hidden="true">
                    <svg viewBox="0 0 16 16"><path d="m3.5 8.2 2.8 2.7 6.2-6.1" /></svg>
                  </span>
                  Verified
                </span>
              )}
            </div>
            <div className="vehicle-photo-gallery">
              {(selectedVehicle.photos?.length ? selectedVehicle.photos : [PLACEHOLDER_VEHICLE_IMAGE]).slice(0, 3).map((photo, index) => (
                <img key={`${selectedVehicle.name}-photo-${index + 1}`} src={photo.startsWith('data:') ? photo : apiUrl(photo)} alt={`${selectedVehicle.name}, photo ${index + 1}`} />
              ))}
            </div>
            <div className="vehicle-contact-panel">
              <div>
                <strong>{selectedVehicle.contactName}</strong>
                <span>{selectedVehicle.contact}</span>
                <span>Year: {selectedVehicle.year}</span>
                <span>Mileage: {selectedVehicle.mileage.toLocaleString()} km</span>
                <span>Transmission: {selectedVehicle.transmission}</span>
                <span>Licence plate: {selectedVehicle.plate || 'Not specified'}</span>
                <span>Showroom: {selectedVehicle.showroom || 'Not specified'}</span>
                {userRole === 'buyer' && (
                  <span className="online-sale-availability">
                    Online sale: <strong>{selectedVehicle.onlineSale ? 'Available' : 'Not offered'}</strong>
                  </span>
                )}
              </div>
              <a
                className="vehicle-call-button"
                href={`tel:${selectedVehicle.contact.replace(/[^\d+]/g, '')}`}
                onClick={(event) => copyPhoneNumber(event, selectedVehicle.contact)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6.6 3.8 9.3 3l2 4.7-2.1 1.6a15.6 15.6 0 0 0 5.5 5.5l1.6-2.1 4.7 2-.8 2.7a2.4 2.4 0 0 1-2.6 1.7A16.2 16.2 0 0 1 4.9 7.1a2.4 2.4 0 0 1 1.7-3.3Z" fill="currentColor" />
                </svg>
                Call
              </a>
              <button
                className="vehicle-chat-button"
                type="button"
                onClick={() => openVehicleChat(selectedVehicle)}
              >
                Chat
              </button>
            </div>
            {userRole === 'buyer' && (
              <button
                className={`interested-button profile-interested-button${interestedVehicleIds.includes(selectedVehicle.id) ? ' is-interested' : ''}`}
                type="button"
                aria-pressed={interestedVehicleIds.includes(selectedVehicle.id)}
                onClick={() => toggleInterestedVehicle(selectedVehicle.id)}
              >
                {interestedVehicleIds.includes(selectedVehicle.id) ? 'Remove from cart' : 'Interested'}
              </button>
            )}
            <p className="phone-copy-status" aria-live="polite">{phoneCopyStatus}</p>
          </section>
        </div>
      )}
      {chatVehicle && (
        <div
          className="vehicle-chat-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) setChatVehicle(null)
          }}
        >
          <section className="vehicle-chat-dialog" role="dialog" aria-modal="true" aria-labelledby="vehicle-chat-title">
            <header className="vehicle-chat-header">
              <div>
                <h2 id="vehicle-chat-title">Chat about {chatVehicle.name}</h2>
                <p>With {chatVehicle.contactName}</p>
              </div>
              <button type="button" className="vehicle-modal-close" aria-label="Close chat" onClick={() => setChatVehicle(null)}>
                &times;
              </button>
            </header>
            <p className="vehicle-chat-notice">
              Messages are stored with this vehicle inquiry and visible to its buyer and seller.
            </p>
            {chatStatus && <p className="seller-form-status" role="alert">{chatStatus}</p>}
            <div className="vehicle-chat-messages" aria-live="polite" aria-relevant="additions">
              {chatMessages.length === 0 ? (
                <p className="vehicle-chat-empty">No messages yet. Start the conversation.</p>
              ) : (
                chatMessages.map((message) => (
                  <article className={`vehicle-chat-message${message.sender === (userRole === 'buyer' ? 'Buyer' : 'Seller') ? ' is-own-message' : ''}`} key={message.id}>
                    <strong>{message.sender}</strong>
                    <p>{message.message}</p>
                    <time dateTime={message.sentAt}>{new Date(message.sentAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>
                  </article>
                ))
              )}
            </div>
            <form className="vehicle-chat-form" onSubmit={sendVehicleChatMessage}>
              <label className="visually-hidden" htmlFor="vehicle-chat-input">Your message</label>
              <input
                id="vehicle-chat-input"
                value={chatDraft}
                onChange={(event) => setChatDraft(event.target.value)}
                placeholder="Write a message..."
                maxLength={1000}
                required
                autoFocus
              />
              <button type="submit" disabled={!chatDraft.trim() || !chatInquiryId}>Send</button>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

export default App
